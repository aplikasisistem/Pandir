#!/bin/bash
# PANDIRSTORE.ID - Git & Netlify Auto-Sync Script

echo "=================================================="
echo "  PANDIRSTORE.ID - Git & Netlify Sync Tool"
echo "=================================================="

# 1. Pastikan folder adalah Git repo
if [ ! -d ".git" ]; then
  echo "[-] Inisialisasi Git repository..."
  git init
fi

# 2. Pastikan branch bernama 'main'
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "[+] Menyetel branch aktif ke 'main'..."
  git branch -M main
fi

# 3. Cek Remote URL
REMOTE_URL=$(git remote get-url origin 2>/dev/null)
if [ -z "$REMOTE_URL" ]; then
  echo "[-] Remote 'origin' belum disetel."
  echo "    Ketikkan URL repository GitHub Anda (contoh: https://github.com/username/pandirstore.git):"
  read -r USER_REPO
  if [ -n "$USER_REPO" ]; then
    git remote add origin "$USER_REPO"
    echo "[+] Remote origin berhasil ditambahkan: $USER_REPO"
  else
    echo "[!] URL tidak boleh kosong. Jalankan ulang script."
    exit 1
  fi
else
  echo "[+] Remote origin: $REMOTE_URL"
fi

# 4. Stage semua file
echo "[+] Menambahkan semua perubahan ke staging (git add -A)..."
git add -A

# 5. Commit perubahan jika ada
if git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "[i] Tidak ada perubahan baru untuk di-commit."
else
  COMMIT_MSG="fix: sync update $(date '+%Y-%m-%d %H:%M:%S')"
  echo "[+] Membuat commit: '$COMMIT_MSG'..."
  git commit -m "$COMMIT_MSG"
fi

# 6. Push ke GitHub
echo "[+] Mengirim commit ke GitHub (git push -u origin main)..."
if git push -u origin main; then
  echo ""
  echo "=================================================="
  echo "  [BERHASIL] Kode terbaru telah terkirim ke GitHub!"
  echo "=================================================="
  echo "Netlify akan mendeteksi commit ini dalam ~5-10 detik."
  echo "Cek status deploy di: https://app.netlify.com"
else
  echo ""
  echo "[!] Push ditolak atau gagal. Mencoba pull --rebase terlebih dahulu..."
  git pull origin main --rebase
  echo "[+] Mencoba push ulang..."
  if git push origin main; then
    echo "=================================================="
    echo "  [BERHASIL] Push berhasil setelah rebase!"
    echo "=================================================="
  else
    echo "[-] Push gagal. Pastikan izin akses GitHub / Token sudah benar."
  fi
fi
