import os
import dj_database_url
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Carga backend/.env si existe (solo en tu máquina — ese archivo NUNCA se sube a git,
# ya está en .gitignore). En Railway no hace falta: las variables ya vienen inyectadas
# directo por la plataforma.
load_dotenv(BASE_DIR / '.env')

# ══════════════════════════════════════════════
#  Variables de entorno (Railway/Vercel en producción, backend/.env en tu
#  máquina local — ver backend/.env.example)
# ══════════════════════════════════════════════

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-tallerdiesel-change-this-in-production-2024')

DEBUG = os.environ.get('DEBUG', 'True') == 'True'

# En Railway define ALLOWED_HOSTS="tuapp.up.railway.app,tudominio.com" (separado por comas)
_allowed_hosts_env = os.environ.get('ALLOWED_HOSTS', '')
ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts_env.split(',') if h.strip()] or ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'tallerdiesel_api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# En Railway agrega el plugin de Postgres: te da automáticamente la variable
# DATABASE_URL y esto se conecta solo. Sin esa variable (tu máquina local),
# sigue usando SQLite como hasta ahora.
if os.environ.get('DATABASE_URL'):
    DATABASES = {
        'default': dj_database_url.config(
            default=os.environ.get('DATABASE_URL'),
            conn_max_age=600,
        )
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'es-mx'
TIME_ZONE = 'America/Mexico_City'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'tallerdiesel_api.Usuario'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    # Límites de solicitudes para endpoints sensibles (fuerza bruta / spam).
    # Los endpoints normales no tienen límite: solo los que declaran
    # throttle_classes con estos scopes (login, auth_codigo).
    'DEFAULT_THROTTLE_RATES': {
        'login': '10/min',
        'auth_codigo': '8/min',
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    # Cada vez que se usa un refresh token para pedir uno nuevo, el anterior
    # se invalida — si alguien copia/roba un token viejo, deja de funcionar.
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

# En Railway define CORS_ALLOWED_ORIGINS="https://tuapp.vercel.app" (separado por
# comas si tienes más de un dominio). Sin esa variable, se permite todo (modo
# desarrollo local, como hasta ahora).
_cors_env = os.environ.get('CORS_ALLOWED_ORIGINS', '')
if _cors_env:
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_env.split(',') if o.strip()]
else:
    CORS_ALLOW_ALL_ORIGINS = True

# URL pública del frontend (Vercel) — se usa en los links de los correos.
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')

# ══════════════════════════════════════════════
#  SEGURIDAD — solo se activa en producción (DEBUG=False), para no
#  romper el desarrollo local por HTTP sin certificado.
# ══════════════════════════════════════════════
if not DEBUG:
    SECURE_SSL_REDIRECT = True          # fuerza HTTPS en todas las peticiones
    SESSION_COOKIE_SECURE = True        # cookies solo por HTTPS
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000      # 1 año — el navegador recuerda usar siempre HTTPS
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True  # evita que el navegador "adivine" tipos de archivo (protección XSS)
    X_FRAME_OPTIONS = 'DENY'            # evita que el sitio se cargue dentro de un <iframe> ajeno (clickjacking)
    SECURE_REFERRER_POLICY = 'same-origin'
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')  # Railway está detrás de un proxy

# ══════════════════════════════════════════════
#  CONFIGURACIÓN DE CORREO
# ══════════════════════════════════════════════
#
#  En Railway define estas variables de entorno: EMAIL_HOST_USER,
#  EMAIL_HOST_PASSWORD (la contraseña de aplicación de Gmail, sin espacios).
#  Localmente, si no defines las variables, usa estos valores por defecto
#  para que siga funcionando igual que hasta ahora.
#
#  OPCIÓN A — Desarrollo (imprime en consola, sin configurar nada):
#  pon la variable de entorno EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
#
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_USE_SSL = os.environ.get('EMAIL_USE_SSL', 'False') == 'True'
EMAIL_TIMEOUT = 10
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', 'tallerdiesel847@gmail.com')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', f'TallerDiesel <{EMAIL_HOST_USER}>')
