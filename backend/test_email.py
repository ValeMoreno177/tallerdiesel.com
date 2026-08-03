"""
Ejecuta desde la carpeta backend/:
  python test_email.py
"""
import os, sys, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.conf import settings
from django.core.mail import send_mail
import smtplib, ssl

print("\n=== DIAGNÓSTICO DE EMAIL ===")
print(f"Host:     {settings.EMAIL_HOST}:{settings.EMAIL_PORT}")
print(f"Usuario:  {settings.EMAIL_HOST_USER}")
print(f"Password: {'*' * len(settings.EMAIL_HOST_PASSWORD)} ({len(settings.EMAIL_HOST_PASSWORD)} chars)")

print("\n1. Probando conexión SMTP...")
try:
    ctx = ssl.create_default_context()
    with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=10) as server:
        server.ehlo()
        server.starttls(context=ctx)
        server.ehlo()
        print("   ✅ Conexión OK")

        print("2. Autenticando...")
        try:
            server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD.replace(' ', ''))
            print("   ✅ Autenticación OK")
        except smtplib.SMTPAuthenticationError as e:
            print(f"   ❌ Autenticación fallida: {e}")
            print("\n   SOLUCIÓN:")
            print("   1. Ve a https://myaccount.google.com/apppasswords")
            print("   2. Genera una nueva contraseña de aplicación")
            print("   3. Reemplaza EMAIL_HOST_PASSWORD en backend/core/settings.py")
            sys.exit(1)

except Exception as e:
    print(f"   ❌ Error de conexión: {e}")
    sys.exit(1)

print("\n3. Enviando correo de prueba...")
destino = input(f"   Correo destino (Enter = {settings.EMAIL_HOST_USER}): ").strip() or settings.EMAIL_HOST_USER

try:
    send_mail(
        subject='TallerDiesel — Prueba',
        message='Si recibes esto, el email funciona correctamente.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[destino],
        fail_silently=False,
    )
    print(f"   ✅ Correo enviado a {destino}")
    print("\n✅ EMAIL FUNCIONANDO CORRECTAMENTE")
except Exception as e:
    print(f"   ❌ Error: {e}")
