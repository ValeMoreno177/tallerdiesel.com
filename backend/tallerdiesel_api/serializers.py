from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (Ticket, Tecnico, Opinion, Proveedor, SolicitudServicio,
                      Notificacion, ComentarioTicket, ConfiguracionEmpresa, UnidadFlotilla,
                      EvidenciaTicket)

User = get_user_model()


class UsuarioSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.ReadOnlyField()
    password = serializers.CharField(write_only=True, required=False)
    # Marca de tiempo de la foto de perfil (None = sin foto). Cambia al subir otra, así el navegador la recarga.
    foto_version = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'nombre', 'apellido_paterno',
                  'apellido_materno', 'empresa', 'telefono', 'puesto', 'rol',
                  'is_active', 'email_verificado', 'fecha_registro', 'nombre_completo', 'password',
                  'puede_editar_sistema', 'aviso_privacidad_aceptado', 'tour_completado', 'foto_version',
                  'numero_coordinador']
        read_only_fields = ['id', 'fecha_registro', 'aviso_privacidad_aceptado', 'tour_completado']

    def get_foto_version(self, obj):
        # En listados el viewset ya trae la fecha (annotate); en login/me se consulta una sola vez.
        if hasattr(obj, 'foto_actualizada'):
            fecha = obj.foto_actualizada
        else:
            from .models import FotoPerfil
            fecha = FotoPerfil.objects.filter(usuario_id=obj.pk).values_list('actualizada', flat=True).first()
        return int(fecha.timestamp()) if fecha else None

    def validate_numero_coordinador(self, valor):
        """El número de turno no se repite entre coordinadores."""
        if valor is None:
            return valor
        otros = User.objects.filter(rol='coordinador', numero_coordinador=valor)
        if self.instance:
            otros = otros.exclude(pk=self.instance.pk)
        if otros.exists():
            raise serializers.ValidationError('Otro coordinador ya tiene ese número.')
        return valor

    def validate(self, data):
        """Un correo no se puede repetir entre cuentas, con UNA excepción: el Administrador puede
        dar de alta varios COORDINADORES con el mismo correo (las veces que haga falta). Nadie más
        puede hacerlo, y un correo de cliente o administrador nunca se comparte."""
        inst = self.instance
        email = (data.get('email', inst.email if inst else '') or '').strip()
        rol = data.get('rol', inst.rol if inst else 'cliente')
        if not email:
            return data
        # Sin cambios de correo ni de rol (p. ej. solo se edita el nombre) no hay nada que revisar
        if inst and email.lower() == inst.email.lower() and rol == inst.rol:
            return data
        otros = User.objects.filter(email__iexact=email)
        if inst:
            otros = otros.exclude(pk=inst.pk)
        if not otros.exists():
            return data
        todos_coordinadores = not otros.exclude(rol='coordinador').exists()
        viewer = getattr(self.context.get('request'), 'user', None)
        if rol == 'coordinador' and todos_coordinadores:
            if getattr(viewer, 'rol', None) != 'admin':
                raise serializers.ValidationError(
                    {'email': 'Solo el Administrador puede usar un correo que ya tiene otro coordinador.'})
            return data
        if rol == 'coordinador':
            raise serializers.ValidationError(
                {'email': 'Ese correo ya pertenece a una cuenta de cliente o administrador y no se puede compartir.'})
        raise serializers.ValidationError({'email': 'Ya existe una cuenta con este correo.'})

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        rol_anterior = instance.rol
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        if instance.rol != rol_anterior:
            # Permisos y tickets que dependen del rol (ver servicios.aplicar_cambio_de_rol)
            from .servicios import aplicar_cambio_de_rol
            aplicar_cambio_de_rol(instance, rol_anterior)
        return instance


class RegistroSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirmar_password = serializers.CharField(write_only=True)
    aceptar_aviso_privacidad = serializers.BooleanField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'nombre', 'apellido_paterno',
                  'apellido_materno', 'empresa', 'telefono', 'puesto',
                  'password', 'confirmar_password', 'aceptar_aviso_privacidad']

    def validate_email(self, value):
        # El registro público nunca comparte correo: solo el Administrador puede (entre coordinadores).
        if User.objects.filter(email__iexact=value.strip()).exists():
            raise serializers.ValidationError('Ya existe una cuenta con este correo.')
        return value

    def validate(self, data):
        if data['password'] != data['confirmar_password']:
            raise serializers.ValidationError({'confirmar_password': 'Las contraseñas no coinciden.'})
        if not data.get('aceptar_aviso_privacidad'):
            raise serializers.ValidationError(
                {'aceptar_aviso_privacidad': 'Debes leer y aceptar el aviso de privacidad para registrarte.'})
        return data

    def create(self, validated_data):
        validated_data.pop('confirmar_password')
        validated_data.pop('aceptar_aviso_privacidad')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.email_verificado = False
        user.aviso_privacidad_aceptado = True
        user.save()
        return user


class ConfiguracionEmpresaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionEmpresa
        fields = ['id', 'nombre_empresa', 'rfc', 'direccion', 'telefono',
                  'email', 'sitio_web', 'actualizado_en']
        read_only_fields = ['id', 'actualizado_en']


class ProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proveedor
        fields = '__all__'


class ComentarioTicketSerializer(serializers.ModelSerializer):
    autor_nombre = serializers.SerializerMethodField()
    autor_rol = serializers.SerializerMethodField()

    class Meta:
        model = ComentarioTicket
        fields = '__all__'

    def get_autor_nombre(self, obj):
        if obj.autor:
            return obj.autor.nombre_completo
        return obj.autor_nombre or 'Sistema'

    def get_autor_rol(self, obj):
        return obj.autor.rol if obj.autor else None


class EvidenciaTicketSerializer(serializers.ModelSerializer):
    # No se expone la URL directa del archivo: se descarga por un endpoint con permisos.
    class Meta:
        model = EvidenciaTicket
        fields = ['id', 'nombre_original', 'subido_por_nombre', 'fecha']


class TicketSerializer(serializers.ModelSerializer):
    coordinador_nombre  = serializers.SerializerMethodField()
    proveedor_nombre    = serializers.SerializerMethodField()
    tecnico_nombre       = serializers.SerializerMethodField()
    eliminado_por_nombre = serializers.SerializerMethodField()
    estatus_display      = serializers.CharField(source='get_estatus_display', read_only=True)
    # Campos calculados — nombres iguales al frontend
    costo    = serializers.ReadOnlyField()
    ganancia = serializers.ReadOnlyField()
    total    = serializers.ReadOnlyField()
    iva      = serializers.ReadOnlyField()
    neto     = serializers.ReadOnlyField()
    isr      = serializers.ReadOnlyField()
    total_f  = serializers.ReadOnlyField()
    comision = serializers.ReadOnlyField()
    comentarios = ComentarioTicketSerializer(many=True, read_only=True)
    evidencias  = EvidenciaTicketSerializer(many=True, read_only=True)
    mensajes_no_leidos = serializers.SerializerMethodField()
    # Calificación del cliente (estrellas al técnico y al servicio)
    calificado          = serializers.SerializerMethodField()
    # ¿Quien consulta puede editar este ticket? (coordinador asignado; otros roles, solo lectura)
    puede_editar        = serializers.SerializerMethodField()
    # Folio, o «Solicitud #n» mientras el ticket espera coordinador
    etiqueta            = serializers.ReadOnlyField()
    puede_calificar     = serializers.SerializerMethodField()
    calificacion_detalle = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = '__all__'

    def get_coordinador_nombre(self, obj):
        return obj.coordinador.nombre_completo if obj.coordinador else None

    def get_eliminado_por_nombre(self, obj):
        return obj.eliminado_por.nombre_completo if obj.eliminado_por else None

    def get_proveedor_nombre(self, obj):
        return obj.proveedor.nombre if obj.proveedor else None

    def get_tecnico_nombre(self, obj):
        return obj.tecnico.nombre if obj.tecnico else None

    def get_mensajes_no_leidos(self, obj):
        return getattr(obj, 'mensajes_no_leidos', 0)

    def _opinion(self, obj):
        # Se usa .all() (no .first()) para aprovechar el prefetch_related('opinion') del viewset.
        ops = list(obj.opinion.all())
        return ops[0] if ops else None

    def get_puede_editar(self, obj):
        from .servicios import puede_gestionar_ticket
        request = self.context.get('request')
        return puede_gestionar_ticket(getattr(request, 'user', None), obj)

    def get_calificado(self, obj):
        return self._opinion(obj) is not None

    def get_puede_calificar(self, obj):
        return bool(obj.estatus == 'terminado' and obj.cliente_id and obj.tecnico_id and not obj.eliminado
                    and self._opinion(obj) is None)

    def get_calificacion_detalle(self, obj):
        op = self._opinion(obj)
        if not op:
            return None
        return {
            'calificacion_tecnico': op.calificacion,
            'comentario': op.comentario,
            'fecha': op.fecha,
        }


class UnidadFlotillaSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnidadFlotilla
        fields = '__all__'
        read_only_fields = ['id', 'creado_en', 'propietario']


class OpinionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Opinion
        fields = '__all__'


class TecnicoSerializer(serializers.ModelSerializer):
    opiniones = OpinionSerializer(many=True, read_only=True)
    categoria_display = serializers.SerializerMethodField()
    calificacion_promedio = serializers.SerializerMethodField()
    total_calificaciones = serializers.SerializerMethodField()

    class Meta:
        model = Tecnico
        fields = '__all__'

    def get_categoria_display(self, obj):
        return obj.get_categoria_display()

    def get_calificacion_promedio(self, obj):
        return getattr(obj, 'promedio_opiniones', None)

    def get_total_calificaciones(self, obj):
        return getattr(obj, 'total_opiniones', 0)


class SolicitudServicioSerializer(serializers.ModelSerializer):
    ticket_codigo = serializers.SerializerMethodField()
    ticket_id_obj = serializers.SerializerMethodField()  # pk del Ticket para abrir el detalle

    class Meta:
        model = SolicitudServicio
        fields = '__all__'

    def get_ticket_codigo(self, obj):
        return obj.ticket.etiqueta if obj.ticket else None

    def get_ticket_id_obj(self, obj):
        return obj.ticket.id if obj.ticket else None


class NotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacion
        fields = '__all__'
