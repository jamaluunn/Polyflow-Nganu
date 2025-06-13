# Polyflow Bot (Airdropversity Mod)

Bot otomatis untuk Polyflow yang dirancang untuk menyelesaikan task harian & tutorial, mengklaim bonus, dan secara otomatis mengupload invoice untuk mendapatkan poin. Versi ini adalah yang paling canggih, dengan kemampuan untuk menghasilkan berbagai jenis bukti transaksi.

---

### ✨ Fitur

-   **Penyelesaian Task Otomatis**: Menyelesaikan semua task harian dan tutorial yang tersedia.
-   **Klaim Bonus Harian**: Mengklaim bonus poin harian secara otomatis.
-   **Upload Invoice Cerdas**:
    -   Membuat **dua jenis gambar** secara acak: struk belanja atau screenshot transaksi wallet.
    -   Menggunakan **mata uang acak** (`KRNL`, `BUBU`, `USDT`, dll.) untuk setiap transaksi.
-   **Opsi Skip Upload**: Anda bisa memilih untuk hanya menjalankan task tanpa melakukan upload.
-   **Anti-deteksi**: Menggunakan User-Agent acak dan data invoice yang sangat bervariasi.
-   **Dukungan Proxy**: Dapat dijalankan dengan proxy untuk setiap akun.
-   **Jeda Acak**: Menggunakan jeda waktu acak antara 12-24 jam setelah semua akun diproses.
-   **Pembersihan Otomatis**: Folder `generated_invoices` akan otomatis dibersihkan setiap kali skrip dijalankan.

---

### ⚙️ Pengaturan

Ikuti langkah-langkah ini untuk menjalankan bot.

#### 1. Prasyarat
Pastikan Anda sudah menginstal [Node.js](https://nodejs.org/) (disarankan versi 18 atau lebih baru).

#### 2. Instalasi
1.  **Unduh atau Clone Repositori Ini:**
    ```bash
    git clone https://github.com/jamaluunn/Polyflow-Nganu.git
    cd Polyflow-Nganu
    ```

2.  **Instal semua dependensi:**
    ```bash
    npm install
    ```

3.  **Buat file `pk.txt`** di folder yang sama dan isi dengan *private key* dari setiap akun wallet Anda, satu per baris.
    > ```
    > 0xPRIVATE_KEY_ANDA_1
    > 0xPRIVATE_KEY_ANDA_2
    > 0xPRIVATE_KEY_ANDA_3
    > ```

4.  **(Opsional) Buat file `proxy.txt`** jika Anda ingin menggunakan proxy. Masukkan proxy Anda, satu per baris, dengan format `ip:port` atau `user:pass@host:port`.
    > ```
    > http://user:pass@host:port
    > socks5://user:pass@host:port
    > ip:port
    > ```

#### 3. Menjalankan Bot
Setelah semua file siap, jalankan bot dengan perintah:
```bash
npm start
```
atau
```bash
node index.js
```
Bot akan menanyakan apakah Anda ingin menggunakan proxy dan apakah ingin melakukan upload. Jawab `y` (yes) atau `n` (no) sesuai kebutuhan Anda.

---

### 📜 Lisensi & Kredit
-   **Original Script**: NT Exhaust
-   **Inspiration & Logic**: vonssy
-   **Modifikasi**: Airdropversity
-   Skrip ini bersifat *open source* dan berlisensi di bawah [MIT License](LICENSE). Anda bebas menggunakan dan memodifikasinya.

