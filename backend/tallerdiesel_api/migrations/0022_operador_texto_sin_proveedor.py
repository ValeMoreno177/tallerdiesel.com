from django.db import migrations


class Migration(migrations.Migration):
    """Proveedor (catálogo con lista) desaparece: el campo de texto libre
    `operador` del ticket ocupa su lugar y se edita a mano."""

    dependencies = [
        ('tallerdiesel_api', '0021_notificacion_archivada'),
    ]

    operations = [
        migrations.RemoveField(model_name='ticket', name='proveedor'),
        migrations.DeleteModel(name='Proveedor'),
    ]
