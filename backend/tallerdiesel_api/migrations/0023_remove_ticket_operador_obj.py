from django.db import migrations


def quitar_columna_si_existe(apps, schema_editor):
    """Borra operador_obj_id solo si todavía existe en la tabla.

    Evita el error 'column "operador_obj_id" ... does not exist' cuando la
    base de datos (p. ej. producción en Railway) ya no tiene la columna.
    """
    Ticket = apps.get_model('tallerdiesel_api', 'Ticket')
    conexion = schema_editor.connection
    with conexion.cursor() as cursor:
        columnas = [
            c.name for c in
            conexion.introspection.get_table_description(cursor, Ticket._meta.db_table)
        ]
    if 'operador_obj_id' in columnas:
        schema_editor.remove_field(Ticket, Ticket._meta.get_field('operador_obj'))


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0022_operador_texto_sin_proveedor'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(quitar_columna_si_existe, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.RemoveField(model_name='ticket', name='operador_obj'),
            ],
        ),
    ]