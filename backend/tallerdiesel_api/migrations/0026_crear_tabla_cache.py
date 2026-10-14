from django.core.management import call_command
from django.db import migrations


def crear_tabla_cache(apps, schema_editor):
    """Crea la tabla del caché compartido (td_cache). El login la usa para limitar intentos,
    así que debe existir siempre: se crea aquí para no depender del comando de arranque."""
    call_command('createcachetable', database=schema_editor.connection.alias, verbosity=0)


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0025_merge_20261014_1120'),
    ]

    operations = [
        migrations.RunPython(crear_tabla_cache, migrations.RunPython.noop),
    ]
