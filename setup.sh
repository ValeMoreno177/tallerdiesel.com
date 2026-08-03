#!/bin/bash
echo ""
echo "============================================"
echo "  TallerDiesel — Configuracion inicial"
echo "============================================"
echo ""

# ── Backend ──────────────────────────────────
echo "Configurando backend Django..."
cd backend

pip install -r requirements.txt

python manage.py makemigrations
python manage.py migrate
python manage.py seed_data

echo ""
echo "Backend listo."
echo ""

# ── Frontend ─────────────────────────────────
echo "Instalando dependencias del frontend..."
cd ../frontend
npm install

echo ""
echo "============================================"
echo "  Para iniciar el proyecto:"
echo "============================================"
echo ""
echo "  Terminal 1 (Backend):"
echo "    cd backend"
echo "    python manage.py runserver"
echo ""
echo "  Terminal 2 (Frontend):"
echo "    cd frontend"
echo "    npm run dev"
echo ""
echo "  Abre: http://localhost:5173"
echo ""
echo "  Usuarios:"
echo "    admin    / admin1234"
echo "    coord1   / coord1234"
echo "    cliente1 / cliente1234"
echo ""
