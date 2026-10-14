from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from decimal import Decimal
import random
import uuid


class UsuarioManager(BaseUserManager):
    def create_user(self, username, email, password=None, **extra_fields):
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault('rol', 'admin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('email_verificado', True)
        return self.create_user(username, email, password, **extra_fields)


class Usuario(AbstractBaseUser, PermissionsMixin):
    ROL_CHOICES = [('admin','Administrador'),('coordinador','Coordinador'),('cliente','Cliente')]
    username        = models.CharField(max_length=150, unique=True)
    # El correo es único, EXCEPTO entre coordinadores: el Administrador puede dar de alta varios
    # coordinadores con el mismo correo (p. ej. un buzón de coordinación). Eso lo valida
    # UsuarioSerializer; aquí la base de datos lo refuerza para clientes y administradores.
    email           = models.EmailField()
    nombre          = models.CharField(max_length=100, blank=True)
    apellido_paterno= models.CharField(max_length=100, blank=True)
    apellido_materno= models.CharField(max_length=100, blank=True)
    empresa         = models.CharField(max_length=200, blank=True)
    telefono        = models.CharField(max_length=20, blank=True)
    puesto          = models.CharField(max_length=100, blank=True)
    rol             = models.CharField(max_length=20, choices=ROL_CHOICES, default='cliente')
    is_active       = models.BooleanField(default=True)
    is_staff        = models.BooleanField(default=False)
    email_verificado= models.BooleanField(default=False)
    fecha_registro  = models.DateTimeField(auto_now_add=True)

    # Permiso que el Administrador puede otorgar a un Coordinador para editar
    # información del sistema (empleados, catálogos, datos generales).
    puede_editar_sistema      = models.BooleanField(default=False)
    aviso_privacidad_aceptado = models.BooleanField(default=False)
    # Recorrido guiado de bienvenida: False = usuario nuevo que aún no lo ve/omite.
    tour_completado           = models.BooleanField(default=False)
    # Número de turno del coordinador (1, 2, 3…): los tickets nuevos se reparten en ese orden.
    numero_coordinador        = models.PositiveIntegerField(null=True, blank=True)
    # Desde cuándo está "libre": se marca cuando finaliza un servicio y se borra al recibir otro ticket.
    # El que lleva más tiempo libre recibe primero el ticket nuevo.
    libre_desde               = models.DateTimeField(null=True, blank=True)

    objects = UsuarioManager()
    USERNAME_FIELD  = 'username'
    REQUIRED_FIELDS = ['email']

    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'
        constraints = [
            models.UniqueConstraint(
                fields=['email'], condition=~models.Q(rol='coordinador'),
                name='usuario_email_unico_salvo_coordinador'),
        ]

    def __str__(self):
        return f'{self.username} ({self.rol})'

    @property
    def nombre_completo(self):
        partes = [self.nombre, self.apellido_paterno, self.apellido_materno]
        return ' '.join(p for p in partes if p) or self.username

    def save(self, *args, **kwargs):
        # Los coordinadores los da de alta el Administrador (no se registran solos), así que su correo
        # NO requiere verificación: la cuenta queda lista para iniciar sesión.
        if self.rol == 'coordinador' and not self.email_verificado:
            self.email_verificado = True
            if kwargs.get('update_fields') is not None:
                kwargs['update_fields'] = set(kwargs['update_fields']) | {'email_verificado'}
        # Todo coordinador tiene su número de turno: si no trae uno, recibe el siguiente disponible.
        if self.rol == 'coordinador' and self.numero_coordinador is None:
            ultimo = Usuario.objects.filter(rol='coordinador').aggregate(m=models.Max('numero_coordinador'))['m'] or 0
            self.numero_coordinador = ultimo + 1
            if kwargs.get('update_fields') is not None:
                kwargs['update_fields'] = set(kwargs['update_fields']) | {'numero_coordinador'}
        super().save(*args, **kwargs)


class TokenVerificacion(models.Model):
    usuario    = models.OneToOneField(Usuario, on_delete=models.CASCADE, related_name='token_verificacion')
    token      = models.UUIDField(default=uuid.uuid4, unique=True)
    codigo     = models.CharField(max_length=6, blank=True)
    intentos   = models.PositiveSmallIntegerField(default=0)
    creado_en  = models.DateTimeField(auto_now_add=True)

    def generar_codigo(self):
        """Genera un código numérico de 6 dígitos y lo asigna (no guarda por sí solo)."""
        self.codigo = f'{random.randint(0, 999999):06d}'
        self.intentos = 0
        return self.codigo


class CodigoRecuperacion(models.Model):
    """Código de 6 dígitos para restablecer contraseña (Olvidé mi contraseña)."""
    usuario    = models.OneToOneField(Usuario, on_delete=models.CASCADE, related_name='codigo_recuperacion')
    codigo     = models.CharField(max_length=6, blank=True)
    intentos   = models.PositiveSmallIntegerField(default=0)
    creado_en  = models.DateTimeField(auto_now_add=True)

    def generar_codigo(self):
        self.codigo = f'{random.randint(0, 999999):06d}'
        self.intentos = 0
        return self.codigo


class ConfiguracionEmpresa(models.Model):
    """Información general del sistema/empresa. Registro único (singleton).
    Solo el Administrador puede editarla."""
    nombre_empresa = models.CharField(max_length=200, default='TallerDiesel')
    rfc            = models.CharField(max_length=20, blank=True)
    direccion      = models.CharField(max_length=300, blank=True)
    telefono       = models.CharField(max_length=20, blank=True)
    email          = models.EmailField(blank=True)
    sitio_web      = models.CharField(max_length=200, blank=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    actualizado_por= models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True)
    # Número del último coordinador que recibió un ticket por turno (el siguiente es el que sigue).
    ultimo_turno   = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Configuración de la empresa'
        verbose_name_plural = 'Configuración de la empresa'

    def __str__(self):
        return self.nombre_empresa

    @classmethod
    def obtener(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)


class Proveedor(models.Model):
    nombre  = models.CharField(max_length=200)
    telefono= models.CharField(max_length=20, blank=True)
    email   = models.EmailField(blank=True)
    activo  = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre


class Ticket(models.Model):
    # Flujo: Pendiente → Atendido → En proceso → Finalizado
    ESTATUS_CHOICES      = [
        ('pendiente', 'Pendiente'),
        ('atendido',  'En camino'),
        ('proceso',   'Reparando'),
        ('terminado', 'Finalizado'),
    ]
    EST_FACTURA_CHOICES = [('pagada','Pagada'),('pendiente','Pendiente')]

    # Folio consecutivo (TD001, TD002…). Se genera cuando el ticket se asigna a un coordinador; mientras
    # está en espera queda vacío. Único solo entre los NO eliminados (ver Meta).
    ticket_id  = models.CharField(max_length=20, blank=True)
    empresa    = models.CharField(max_length=200)
    fecha      = models.DateField()
    estatus    = models.CharField(max_length=20, choices=ESTATUS_CHOICES, default='pendiente')
    tipo_unidad= models.CharField(max_length=200, blank=True)
    unidad     = models.CharField(max_length=200)
    lugar      = models.CharField(max_length=200, blank=True)
    # Ubicación del servicio en el mapa (la fija el coordinador al asignar técnico)
    latitud    = models.FloatField(null=True, blank=True)
    longitud   = models.FloatField(null=True, blank=True)
    operador   = models.CharField(max_length=200, blank=True)
    reparacion = models.TextField(blank=True)

    coordinador= models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True,
                    related_name='tickets_coordinados', limit_choices_to={'rol__in':['coordinador','admin']})
    proveedor  = models.ForeignKey(Proveedor, on_delete=models.SET_NULL, null=True, blank=True)
    cliente    = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True,
                    related_name='tickets_cliente', limit_choices_to={'rol':'cliente'})
    tecnico    = models.ForeignKey('Tecnico', on_delete=models.SET_NULL, null=True, blank=True,
                    related_name='tickets_asignados')

    # Costos (nombres cortos = nombres del frontend)
    sal_costo    = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    mo_costo     = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    ref_costo    = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sal_ganancia = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    mo_ganancia  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    ref_ganancia = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # Factura
    factura         = models.CharField(max_length=50, blank=True)
    fecha_factura   = models.DateField(null=True, blank=True)
    estatus_factura = models.CharField(max_length=20, choices=EST_FACTURA_CHOICES, blank=True, default='pendiente')

    puede_editar_coordinador = models.BooleanField(default=False)
    # El Coordinador solicita finalizar; el Cliente decide si se finaliza o no.
    finalizacion_solicitada = models.BooleanField(default=False)
    alerta_sla_enviada = models.BooleanField(default=False)  # evita duplicar alertas de SLA
    fecha_ultimo_mensaje_cliente = models.DateTimeField(null=True, blank=True)
    fecha_ultima_respuesta_coordinador = models.DateTimeField(null=True, blank=True)
    alerta_respuesta_sla_enviada = models.BooleanField(default=False)
    tipo_solicitud = models.CharField(
        max_length=20,
        choices=[('coordinador','Coordinador'),('tecnico','Técnico')],
        default='coordinador'
    )  # Admin otorga permiso de edición al coordinador para este ticket
    fecha_creacion      = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    # Momento en que el servicio pasó a "Finalizado" (se usa para pedir la calificación al cliente).
    fecha_finalizacion  = models.DateTimeField(null=True, blank=True)

    # ── Papelera (borrado suave) ──────────────────────────────────────────
    eliminado    = models.BooleanField(default=False)
    eliminado_en = models.DateTimeField(null=True, blank=True)
    eliminado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True,
                        related_name='tickets_eliminados')

    class Meta:
        ordering = ['-fecha_creacion']
        constraints = [
            models.UniqueConstraint(fields=['ticket_id'],
                                     condition=models.Q(eliminado=False) & ~models.Q(ticket_id=''),
                                     name='ticket_id_unico_entre_activos'),
        ]

    def __str__(self):
        return f'{self.etiqueta} - {self.empresa}'

    @property
    def etiqueta(self):
        """Cómo nombrar al ticket en avisos y correos: su folio, o «Solicitud #n» mientras espera coordinador."""
        return self.ticket_id or f'Solicitud #{self.pk}'

    @staticmethod
    def _siguiente_folio():
        import re
        max_num = 0
        for tid in Ticket.objects.filter(eliminado=False).exclude(ticket_id='').values_list('ticket_id', flat=True):
            m = re.match(r'TD(\d+)$', tid)
            if m:
                max_num = max(max_num, int(m.group(1)))
        return f'TD{max_num + 1:03d}'

    def asignar_folio(self):
        """Le pone el siguiente folio consecutivo si aún no lo tiene (se llama al asignarlo a un coordinador).
        Seguro ante dos asignaciones a la vez: si el folio ya lo tomó otro ticket, reintenta con el siguiente."""
        from django.db import IntegrityError, transaction
        if self.ticket_id:
            return self.ticket_id
        for _ in range(10):
            folio = self._siguiente_folio()
            try:
                with transaction.atomic():
                    filas = Ticket.objects.filter(pk=self.pk, ticket_id='').update(ticket_id=folio)
            except IntegrityError:
                continue
            if filas:
                self.ticket_id = folio
            else:                       # otro proceso ya le puso folio a este ticket
                self.refresh_from_db(fields=['ticket_id'])
            return self.ticket_id
        raise RuntimeError('No se pudo generar el folio del ticket.')

    def save(self, *args, **kwargs):
        # El folio se genera cuando el ticket tiene coordinador. Un ticket sin coordinador (solicitud en
        # espera) no consume folio todavía.
        if not self.ticket_id and self.coordinador_id:
            self.ticket_id = self._siguiente_folio()
        super().save(*args, **kwargs)

    # ── Fórmulas (exactas al requerimiento) ──────────────────────────────────
    @property
    def costo(self):
        return self.sal_costo + self.mo_costo + self.ref_costo

    @property
    def ganancia(self):
        return self.sal_ganancia + self.mo_ganancia + self.ref_ganancia

    @property
    def total(self):
        # Total = Costo Total + Ganancia Total
        return self.costo + self.ganancia

    @property
    def iva(self):
        # IVA = Total * 0.16
        return self.total * Decimal('0.16')

    @property
    def neto(self):
        # NETO = Total + IVA
        return self.total + self.iva

    @property
    def isr(self):
        # ISR = Total * 0.0125
        return self.total * Decimal('0.0125')

    @property
    def total_f(self):
        # Total Final = Neto - ISR
        return self.neto - self.isr

    @property
    def comision(self):
        # Comisión = Ganancia * 0.15
        return self.ganancia * Decimal('0.15')


class ComentarioTicket(models.Model):
    ticket          = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='comentarios')
    autor           = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True)
    autor_nombre    = models.CharField(max_length=200, blank=True)
    texto           = models.TextField()
    es_cambio_estatus = models.BooleanField(default=False)
    editado         = models.BooleanField(default=False)  # el autor modificó el texto después de enviarlo
    evidencia       = models.ForeignKey('EvidenciaTicket', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')  # foto/PDF que muestra este comentario
    estatus_anterior  = models.CharField(max_length=50, blank=True)
    estatus_nuevo     = models.CharField(max_length=50, blank=True)
    fecha           = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['fecha']


def ruta_evidencia(instance, filename):
    import os
    ext = os.path.splitext(filename)[1].lower()
    return f'evidencias/ticket_{instance.ticket_id}/{uuid.uuid4().hex}{ext}'


class FotoPerfil(models.Model):
    """Foto de perfil del usuario. Se guarda en la base de datos (ya recortada a unos 256 px por el
    navegador), en una tabla aparte para no cargarla en cada petición, y sin depender del disco del
    servidor, que en la nube se borra en cada despliegue."""
    usuario     = models.OneToOneField(Usuario, on_delete=models.CASCADE, related_name='foto_perfil')
    contenido   = models.BinaryField()
    tipo        = models.CharField(max_length=20)          # image/jpeg · image/png · image/webp
    actualizada = models.DateTimeField(auto_now=True)


class EvidenciaTicket(models.Model):
    """Foto / PDF que el Coordinador o Admin sube como evidencia del servicio
    (normalmente cuando el cliente la solicita)."""
    ticket           = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='evidencias')
    archivo          = models.FileField(upload_to=ruta_evidencia)
    nombre_original  = models.CharField(max_length=255)
    subido_por       = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True)
    subido_por_nombre = models.CharField(max_length=200, blank=True)
    fecha            = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['fecha']


class Tecnico(models.Model):
    CATEGORIA_CHOICES = [
        ('motor_diesel','Motor diesel'),('electrico','Eléctrico'),
        ('frenos_suspension','Frenos y suspensión'),('transmision','Transmisión'),
        ('hidraulico','Sistema hidráulico'),('aire','Sistema de aire'),
        ('mecanica','Mecánica general'),('soldadura','Soldadura'),
    ]
    nombre      = models.CharField(max_length=200)
    categoria   = models.CharField(max_length=50, choices=CATEGORIA_CHOICES)
    descripcion = models.TextField(blank=True)
    ciudad      = models.CharField(max_length=100)
    estado      = models.CharField(max_length=100)
    direccion   = models.CharField(max_length=300, blank=True)
    telefono    = models.CharField(max_length=20)
    latitud     = models.FloatField()
    longitud    = models.FloatField()
    calificacion= models.FloatField(default=5.0)
    activo      = models.BooleanField(default=True)
    disponible  = models.BooleanField(default=True)  # True=disponible, False=ocupado

    def __str__(self):
        return f'{self.nombre} - {self.get_categoria_display()}'


class Opinion(models.Model):
    """Calificación del técnico asociada a un servicio. El comentario es opcional.
    `calificacion_servicio` se conserva para compatibilidad con opiniones históricas."""
    tecnico      = models.ForeignKey(Tecnico, on_delete=models.CASCADE, related_name='opiniones',
                                     null=True, blank=True)
    ticket       = models.ForeignKey('Ticket', on_delete=models.SET_NULL, null=True, blank=True, related_name='opinion')
    nombre_autor = models.CharField(max_length=100)
    calificacion = models.IntegerField(null=True, blank=True)
    calificacion_servicio = models.PositiveSmallIntegerField(null=True, blank=True)
    comentario   = models.TextField(blank=True)
    fecha        = models.DateTimeField(auto_now_add=True)


class UnidadFlotilla(models.Model):
    """Catálogo reutilizable de unidades por cliente/empresa, para no capturar
    tipo de unidad y número cada vez que se solicita un servicio."""
    propietario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='unidades_flotilla')
    tipo_unidad = models.CharField(max_length=200, blank=True)
    unidad      = models.CharField(max_length=200)
    activo      = models.BooleanField(default=True)
    creado_en   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['unidad']

    def __str__(self):
        return f'{self.unidad} ({self.tipo_unidad})' if self.tipo_unidad else self.unidad


class SolicitudServicio(models.Model):
    nombre_completo = models.CharField(max_length=200)
    telefono        = models.CharField(max_length=20)
    empresa         = models.CharField(max_length=200, blank=True)
    lugar           = models.CharField(max_length=200, blank=True)   # Ubicación del cliente
    tipo_unidad     = models.CharField(max_length=200, blank=True)   # Tipo de unidad (ej. Tractocamión, Caja seca...)
    unidad          = models.CharField(max_length=200, blank=True)   # Datos / número de unidad
    problema        = models.TextField()
    fecha           = models.DateTimeField(auto_now_add=True)
    atendida        = models.BooleanField(default=False)
    cliente         = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True)
    ticket          = models.OneToOneField(Ticket, on_delete=models.SET_NULL, null=True, blank=True,
                          related_name='solicitud_origen')

    class Meta:
        ordering = ['-fecha']


class Notificacion(models.Model):
    destinatario  = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='notificaciones')
    titulo        = models.CharField(max_length=200)
    mensaje       = models.TextField()
    leida         = models.BooleanField(default=False)
    tipo          = models.CharField(max_length=50, default='solicitud')
    referencia_id = models.IntegerField(null=True, blank=True)
    archivada      = models.BooleanField(default=False)
    fecha         = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha']

# ─── Permiso de edición de ticket cerrado otorgado por el Admin al Coordinador ───
# Se guarda en el Ticket mismo para granularidad por ticket
# Se añade un campo en Ticket
