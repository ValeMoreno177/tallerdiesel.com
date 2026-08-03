from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from tallerdiesel_api.models import Tecnico, Proveedor, Ticket
from datetime import date

User = get_user_model()


class Command(BaseCommand):
    help = 'Crea datos iniciales para TallerDiesel'

    def handle(self, *args, **kwargs):
        self.stdout.write('Creando usuarios...')

        admin_user, _ = User.objects.get_or_create(
            username='admin',
            defaults={'email': 'admin@tallerdiesel.com', 'rol': 'admin',
                      'is_staff': True, 'is_superuser': True, 'nombre': 'Admin',
                      'email_verificado': True}
        )
        admin_user.set_password('admin1234')
        admin_user.email_verificado = True
        admin_user.save()

        coord, _ = User.objects.get_or_create(
            username='coord1',
            defaults={'email': 'coord@tallerdiesel.com', 'rol': 'coordinador',
                      'nombre': 'Carlos', 'apellido_paterno': 'Méndez',
                      'empresa': 'Taller Diesel', 'email_verificado': True}
        )
        coord.set_password('coord1234')
        coord.email_verificado = True
        coord.save()

        cliente, _ = User.objects.get_or_create(
            username='cliente1',
            defaults={'email': 'cliente@empresa.com', 'rol': 'cliente',
                      'nombre': 'Juan', 'apellido_paterno': 'Pérez',
                      'empresa': 'Transportes XYZ', 'email_verificado': True}
        )
        cliente.set_password('cliente1234')
        cliente.email_verificado = True
        cliente.save()

        self.stdout.write('Creando proveedores...')
        prov1, _ = Proveedor.objects.get_or_create(nombre='Refac Norte', defaults={'telefono': '8111234567'})
        prov2, _ = Proveedor.objects.get_or_create(nombre='Partes Diesel', defaults={'telefono': '8119876543'})
        prov3, _ = Proveedor.objects.get_or_create(nombre='Auto Partes GDL', defaults={'telefono': '3331234567'})

        self.stdout.write('Creando técnicos...')
        tecnicos = [
            {'nombre': 'Arturo Jiménez Morales', 'categoria': 'aire', 'ciudad': 'Tijuana',
             'estado': 'Baja California', 'direccion': 'Blvd. Agua Caliente 9800, Col. Aviación',
             'telefono': '6641234567', 'latitud': 32.5027, 'longitud': -117.0037,
             'descripcion': 'Sistemas de aire, compresores, válvulas y frenos neumáticos para tractocamiones.'},
            {'nombre': 'Marco Fuentes', 'categoria': 'motor_diesel', 'ciudad': 'Monterrey',
             'estado': 'Nuevo León', 'direccion': 'Av. Constitución 100',
             'telefono': '8121234567', 'latitud': 25.6866, 'longitud': -100.3161,
             'descripcion': 'Reparación y overhaul de motores diesel pesados.'},
            {'nombre': 'Rosa Vargas', 'categoria': 'electrico', 'ciudad': 'Guadalajara',
             'estado': 'Jalisco', 'direccion': 'Calle López Cotilla 500',
             'telefono': '3331234567', 'latitud': 20.6597, 'longitud': -103.3496,
             'descripcion': 'Diagnóstico y reparación de sistemas eléctricos.'},
            {'nombre': 'Jorge Salinas', 'categoria': 'transmision', 'ciudad': 'Ciudad de México',
             'estado': 'CDMX', 'direccion': 'Eje Central 200',
             'telefono': '5551234567', 'latitud': 19.4326, 'longitud': -99.1332,
             'descripcion': 'Especialista en transmisiones automáticas y manuales.'},
            {'nombre': 'Luis Herrera', 'categoria': 'frenos_suspension', 'ciudad': 'Puebla',
             'estado': 'Puebla', 'direccion': 'Blvd. Atlixcáyotl 1900',
             'telefono': '2221234567', 'latitud': 19.0414, 'longitud': -98.2063,
             'descripcion': 'Frenos de aire, suspensión neumática y mecánica.'},
        ]
        for t in tecnicos:
            Tecnico.objects.get_or_create(nombre=t['nombre'], defaults=t)

        self.stdout.write('Creando tickets de ejemplo...')
        tickets_data = [
            {'empresa': 'Transportes XYZ', 'fecha': date(2025, 1, 10), 'estatus': 'terminado',
             'unidad': 'Kenworth T680', 'lugar': 'Monterrey, NL', 'operador': 'Juan Pérez',
             'reparacion': 'Cambio de motor completo', 'coordinador': coord, 'proveedor': prov1,
             'cliente': cliente, 'sal_ganancia': 5000, 'mo_ganancia': 8000,
             'ref_ganancia': 7000, 'factura': 'FAC-001',
             'fecha_factura': date(2025, 1, 12), 'estatus_factura': 'pagada'},
            {'empresa': 'Fletes del Norte', 'fecha': date(2025, 1, 15), 'estatus': 'terminado',
             'unidad': 'Freightliner M2', 'lugar': 'Saltillo, Coah', 'operador': 'Luis Gómez',
             'reparacion': 'Frenos y suspensión', 'coordinador': coord, 'proveedor': prov2,
             'sal_ganancia': 2000, 'mo_ganancia': 5000, 'ref_ganancia': 4000,
             'factura': 'FAC-002', 'fecha_factura': date(2025, 1, 17), 'estatus_factura': 'pendiente'},
            {'empresa': 'Carga Rápida SA', 'fecha': date(2025, 2, 3), 'estatus': 'proceso',
             'unidad': 'Volvo FH16', 'lugar': 'CDMX', 'operador': 'Pedro Ruiz',
             'reparacion': 'Sistema eléctrico', 'coordinador': coord,
             'sal_ganancia': 3000, 'mo_ganancia': 6000, 'ref_ganancia': 7500,
             'estatus_factura': 'pendiente'},
            {'empresa': 'Transportes XYZ', 'fecha': date(2025, 2, 18), 'estatus': 'pendiente',
             'unidad': 'Kenworth T800', 'lugar': 'Puebla, Pue', 'operador': 'Juan Pérez',
             'reparacion': 'Transmisión dañada', 'coordinador': coord,
             'sal_ganancia': 7000, 'mo_ganancia': 10000, 'ref_ganancia': 10000,
             'estatus_factura': 'pendiente'},
            {'empresa': 'Logística MX', 'fecha': date(2025, 3, 5), 'estatus': 'terminado',
             'unidad': 'Peterbilt 579', 'lugar': 'Guadalajara, Jal', 'operador': 'Ana Torres',
             'reparacion': 'Cambio de frenos', 'coordinador': coord, 'proveedor': prov3,
             'sal_ganancia': 1500, 'mo_ganancia': 4000, 'ref_ganancia': 3000,
             'factura': 'FAC-003', 'fecha_factura': date(2025, 3, 7), 'estatus_factura': 'pagada'},
        ]
        for td in tickets_data:
            if not Ticket.objects.filter(empresa=td['empresa'], fecha=td['fecha']).exists():
                Ticket.objects.create(**td)

        self.stdout.write(self.style.SUCCESS('\n✅ Datos iniciales creados correctamente.'))
        self.stdout.write('  admin    / admin1234')
        self.stdout.write('  coord1   / coord1234')
        self.stdout.write('  cliente1 / cliente1234')
