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
    email           = models.EmailField(unique=True)
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

    objects = UsuarioManager()
    USERNAME_FIELD  = 'username'
    REQUIRED_FIELDS = ['email']

    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def __str__(self):
        return f'{self.username} ({self.rol})'

    @property
    def nombre_completo(self):
        partes = [self.nombre, self.apellido_paterno, self.apellido_materno]
        return ' '.join(p for p in partes if p) or self.username


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

    ticket_id  = models.CharField(max_length=20, blank=True)  # único solo entre los NO eliminados (ver Meta)
    empresa    = models.CharField(max_length=200)
    fecha      = models.DateField()
    estatus    = models.CharField(max_length=20, choices=ESTATUS_CHOICES, default='pendiente')
    tipo_unidad= models.CharField(max_length=200, blank=True)
    unidad     = models.CharField(max_length=200)
    lugar      = models.CharField(max_length=200, blank=True)
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
    alerta_sla_enviada = models.BooleanField(default=False)  # evita duplicar alertas de SLA
    tipo_solicitud = models.CharField(
        max_length=20,
        choices=[('coordinador','Coordinador'),('tecnico','Técnico')],
        default='coordinador'
    )  # Admin otorga permiso de edición al coordinador para este ticket
    fecha_creacion      = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    # ── Papelera (borrado suave) ──────────────────────────────────────────
    eliminado    = models.BooleanField(default=False)
    eliminado_en = models.DateTimeField(null=True, blank=True)
    eliminado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True,
                        related_name='tickets_eliminados')

    class Meta:
        ordering = ['-fecha_creacion']
        constraints = [
            models.UniqueConstraint(fields=['ticket_id'], condition=models.Q(eliminado=False),
                                     name='ticket_id_unico_entre_activos'),
        ]

    def __str__(self):
        return f'{self.ticket_id} - {self.empresa}'

    def save(self, *args, **kwargs):
        if not self.ticket_id:
            import re
            max_num = 0
            for tid in Ticket.objects.filter(eliminado=False).exclude(ticket_id='').values_list('ticket_id', flat=True):
                m = re.match(r'TD(\d+)$', tid)
                if m:
                    max_num = max(max_num, int(m.group(1)))
            self.ticket_id = f'TD{max_num + 1:03d}'
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
    estatus_anterior  = models.CharField(max_length=50, blank=True)
    estatus_nuevo     = models.CharField(max_length=50, blank=True)
    fecha           = models.DateTimeField(auto_now_add=True)

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
    tecnico      = models.ForeignKey(Tecnico, on_delete=models.CASCADE, related_name='opiniones')
    ticket       = models.ForeignKey('Ticket', on_delete=models.SET_NULL, null=True, blank=True, related_name='opinion')
    nombre_autor = models.CharField(max_length=100)
    calificacion = models.IntegerField(default=5)
    comentario   = models.TextField()
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
    fecha         = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha']

# ─── Permiso de edición de ticket cerrado otorgado por el Admin al Coordinador ───
# Se guarda en el Ticket mismo para granularidad por ticket
# Se añade un campo en Ticket
