#!/bin/bash
# ═══════════════════════════════════════════
# VGM Vinyl Creator — Quick Setup
# ═══════════════════════════════════════════

echo ""
echo "🎵 VGM Vinyl Creator — Electron Edition"
echo "═══════════════════════════════════════"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non trouvé. Installe-le depuis https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Node.js v18+ requis (tu as v$(node -v))"
    exit 1
fi

echo "✅ Node.js $(node -v) détecté"
echo ""

# Install dependencies
echo "📦 Installation des dépendances..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'installation"
    exit 1
fi

echo ""
echo "✅ Installation terminée !"
echo ""
echo "═══════════════════════════════════════"
echo "  Commandes disponibles :"
echo ""
echo "  npm run dev           → Mode navigateur (Vite)"
echo "  npm run electron:dev  → Mode Electron (bureau)"
echo "  npm run electron:build → Construire l'exécutable"
echo "═══════════════════════════════════════"
echo ""
