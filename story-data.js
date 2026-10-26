// Data cerita saja, diambil dari novel.js. Tidak memakai NovelScene atau API novel lainnya.
window.POLISODIUM_STORIES = Object.freeze({
    1: {
      title: 'PROLOGUE',
      mode: 'narration',
      pages: [
        "Banjarmasin, 1997.",
        "Kota sungai yang tak pernah benar-benar tidur. Perahu melintas, lampu rumah berpendar, dan malam membawa cerita yang tak semua orang berani dengar.",
        "Belakangan, kabar tentang penampakan dan gangguan makhluk gaib tersebar dari mulut ke mulut.",
        "Kebanyakan orang memilih mengunci pintu. Namun, seorang pemuda justru mendatangi tempat-tempat yang dikabarkan berhantu.",
        "Baginya, jika sesuatu mengganggu warga, ia harus melihatnya sendiri.",
        "Malam ini, sebuah kabar akan memulai rangkaian peristiwa yang tak pernah ia bayangkan."
      ],
      endLabel: 'MULAI'
    },
    2: {
      title: 'KUYANG',
      pages: [
        'WARGA: Kau dengar kabar dari gang sebelah? Ada kuyang berkeliaran.',
        'MC: Siapa yang melihatnya?',
        'WARGA: Beberapa orang. Katanya, makhluk itu mendatangi rumah yang punya bayi.',
        'MC: Sudah ada yang mencoba mengusirnya?',
        'WARGA: Belum. Orang-orang takut keluar malam.',
        'MC: Tunjukkan rumahnya. Aku akan memeriksa sendiri.',
        'Di dekat rumah itu, sebuah bayangan melintas di atas atap.',
        'MC: Aku melihatmu! Jangan bersembunyi!'
      ],
      enemyId: 1,
      enemyName: 'KUYANG',
      endLabel: 'MULAI BATTLE'
    },
    3: {
      title: 'POCONG',
      pages: [
        'PEMILIK RUMAH: Tolong periksa belakang rumahku. Ada suara lompatan dari arah kuburan.',
        'MC: Pernah melihat sesuatu?',
        'PEMILIK RUMAH: Anakku melihat sosok putih di dekat jendela.',
        'MC: Kalian tunggu di dalam. Biar aku periksa.',
        'Di halaman belakang, sosok putih berdiri di antara nisan.',
        'MC: Hei! Kalau kau penyebab gangguan ini, hadapi aku!',
        'Sosok itu mulai melompat mendekat.',
        'MC: Mari kita lihat seberapa menakutkan dirimu!'
      ],
      enemyId: 2,
      enemyName: 'POCONG',
      endLabel: 'MULAI BATTLE'
    },
    4: {
      title: 'HANTU BANYU',
      pages: [
        'WARGA: Ada sesuatu yang muncul dari sungai setiap malam.',
        'MC: Apa yang dilakukannya?',
        'WARGA: Perahu berguncang sendiri. Kadang terdengar suara dari bawah rumah.',
        'MC: Ada yang melihat wujudnya?',
        'WARGA: Seorang nelayan melihat sosok menyerupai manusia di permukaan air.',
        'MC: Aku akan menunggu di tepi sungai malam ini.',
        'Air yang semula tenang mendadak beriak. Sesuatu muncul dari kegelapan.',
        'MC: Jadi, kaulah yang mengganggu permukiman ini!'
      ],
      enemyId: 3,
      enemyName: 'HANTU BANYU',
      endLabel: 'MULAI BATTLE'
    },
    5: {
      title: 'HANTU KELAMBU',
      pages: [
        'PENGENDARA: Ada kain besar yang melompat dari pinggir jembatan!',
        'MC: Kain yang melompat?',
        'PENGENDARA: Kain itu menangkapku. Orang-orang lain juga mengalaminya.',
        'MC: Kapan makhluk itu muncul?',
        'PENGENDARA: Selalu malam hari. Tak ada yang berani lewat sendirian.',
        'MC: Kalau begitu, aku akan ke sana malam ini.',
        'PENGENDARA: Kau bisa ikut ditangkap!',
        'MC: Justru aku ingin melihat sendiri makhluk yang membuat semua orang takut.',
        'Di tengah jembatan, sebuah kain besar melompat dari kegelapan.',
        'MC: Akhirnya kau muncul juga!'
      ],
      enemyId: 4,
      enemyName: 'HANTU KELAMBU',
      endLabel: 'MULAI BATTLE'
    },
    6: {
      title: 'ANAK SIMA',
      pages: [
        'WARGA: Jangan lewati jalan setapak itu setelah matahari terbenam.',
        'MC: Kenapa? Apa yang ada di sana?',
        'WARGA: Ada anak kecil yang mengganggu orang lewat. Tak ada yang tahu siapa dia.',
        'MC: Aku akan mencari tahu sendiri.',
        'Di jalan setapak, seorang anak berdiri membelakangi MC.',
        'MC: Hei, sedang apa sendirian di sini?',
        'Anak itu perlahan berbalik. Wujudnya berubah menjadi makhluk mengerikan.',
        'MC: Jadi, kau bukan anak biasa. Aku tak akan membiarkanmu mengganggu warga lagi!'
      ],
      enemyId: 5,
      enemyName: 'ANAK SIMA',
      endLabel: 'MULAI BATTLE'
    },
    7: {
      title: 'MARIABAN',
      pages: [
        'Setelah Anak Sima dikalahkan, tanah bergetar. Pepohonan bergoyang tanpa angin.',
        'MC: Apa yang terjadi sekarang?',
        'MARIABAN: SIAPA YANG TELAH MENGALAHKAN ANAK ASUHKU?',
        'MC: Kau pasti Mariaban.',
        'MARIABAN: KAU BERANI MEMASUKI WILAYAHKU DAN MENYAKITI ANAKKU?',
        'MC: Dia mengganggu orang-orang yang lewat. Aku hanya menghentikannya.',
        'MARIABAN: KAU AKAN MENYESALI PERBUATANMU!',
        'MC: Kau lebih besar daripada yang kubayangkan... tapi aku tidak akan mundur.',
        'MARIABAN: BERSIAPLAH MENGHADAPI KEHANCURANMU!',
        'MC: Ayo! Tunjukkan semua kekuatanmu!'
      ],
      enemyId: 6,
      enemyName: 'MARIABAN',
      endLabel: 'MULAI FINAL BATTLE'
    },
    8: {
      title: 'JUMAT KELABU',
      mode: 'narration',
      pages: [
        'Banjarmasin, Mei 1997.',
        'Setelah malam-malam penuh gangguan, MC berharap kehidupan kota kembali seperti sediakala.',
        'Namun, ancaman berikutnya bukan sesuatu yang dapat ia hadapi dengan cara yang sama.',
        'Pada 23 Mei 1997, kerusuhan yang dikenang sebagai Jumat Kelabu mengguncang Banjarmasin.',
        'Jalanan berubah mencekam. Ketakutan menyebar di antara warga, dan kehidupan kota tak lagi terasa sama.',
        'MC berdiri di tengah kota. Selama ini ia percaya keberanian cukup untuk menghadapi apa pun.',
        'Kini, tak ada monster yang bisa ia tantang. Tak ada pertarungan yang dapat mengembalikan semuanya.',
        'Hanya sebuah kota yang terluka, dan seorang pemuda yang memahami batas kekuatannya sendiri.',
        'Banjarmasin... semoga kita bertemu lagi dalam keadaan yang lebih baik.',
        'POLISODIUM — TO BE CONTINUED...'
      ],
      endLabel: 'SELESAI'
    }
  });

