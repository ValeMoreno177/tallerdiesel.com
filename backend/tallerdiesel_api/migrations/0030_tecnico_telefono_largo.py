from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tallerdiesel_api', '0029_nuevas_categorias_tecnico'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tecnico',
            name='telefono',
            field=models.CharField(max_length=100),
        ),
    ]
