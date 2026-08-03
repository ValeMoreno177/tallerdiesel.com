from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (Ticket, Tecnico, Opinion, Proveedor, SolicitudServicio,
                      Notificacion, ComentarioTicket, ConfiguracionEmpresa, UnidadFlotilla)

User = get_user_model()


class UsuarioSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.ReadOnlyField()
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'nombre', 'apellido_paterno',
                  'apellido_materno', 'empresa', 'telefono', 'puesto', 'rol',
                  'is_active', 'email_verificado', 'fecha_registro', 'nombre_completo', 'password',
                  'puede_editar_sistema', 'aviso_privacidad_aceptado']
        read_only_fields = ['id', 'fecha_registro', 'aviso_privacidad_aceptado']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
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


class TicketSerializer(serializers.ModelSerializer):
    coordinador_nombre  = serializers.SerializerMethodField()
    proveedor_nombre    = serializers.SerializerMethodField()
    tecnico_nombre       = serializers.SerializerMethodField()
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

    class Meta:
        model = Ticket
        fields = '__all__'

    def get_coordinador_nombre(self, obj):
        return obj.coordinador.nombre_completo if obj.coordinador else None

    def get_proveedor_nombre(self, obj):
        return obj.proveedor.nombre if obj.proveedor else None

    def get_tecnico_nombre(self, obj):
        return obj.tecnico.nombre if obj.tecnico else None


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

    class Meta:
        model = Tecnico
        fields = '__all__'

    def get_categoria_display(self, obj):
        return obj.get_categoria_display()


class SolicitudServicioSerializer(serializers.ModelSerializer):
    ticket_codigo = serializers.SerializerMethodField()
    ticket_id_obj = serializers.SerializerMethodField()  # pk del Ticket para abrir el detalle

    class Meta:
        model = SolicitudServicio
        fields = '__all__'

    def get_ticket_codigo(self, obj):
        return obj.ticket.ticket_id if obj.ticket else None

    def get_ticket_id_obj(self, obj):
        return obj.ticket.id if obj.ticket else None


class NotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacion
        fields = '__all__'
