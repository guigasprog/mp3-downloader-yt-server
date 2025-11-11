const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");

const app = express();
const PORT = 3000;

const allowedOrigins = [
  "https://mp3-downloader-yt.vercel.app",
  "https://mp3-downloader-yt-client.vercel.app",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Acesso não permitido por CORS"));
    }
  },
  exposedHeaders: "Content-Disposition",
};

app.use(cors(corsOptions));

// ... (todo o seu código do app.get('/download') permanece igual)
app.get("/download", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("URL não fornecida.");
  }

  try {
    if (url.includes("playlist?list=")) {
      const titleProcess = spawn("yt-dlp", [
        "--print",
        "%(playlist_title)s",
        "--playlist-items",
        "1",
        url,
      ]);

      let playlistTitle = "";
      for await (const chunk of titleProcess.stdout) {
        playlistTitle = chunk
          .toString()
          .trim()
          .replace(/[^\x00-\x7F]/g, "")
          .replace(/[\/\\?%*:|"<>]/g, "_");
      }
      if (!playlistTitle) playlistTitle = `playlist_${Date.now()}`;

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${playlistTitle}.zip"`
      );
      res.setHeader("Content-Type", "application/zip");

      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.pipe(res);

      console.log(`Iniciando download da playlist: ${playlistTitle}`);

      const tempDir = path.join(__dirname, "temp_audio");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

      const ytDlpProcess = spawn("yt-dlp", [
        url,
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "-o",
        path.join(tempDir, "%(title)s.%(ext)s"),
        "--embed-thumbnail",
      ]);

      ytDlpProcess.stdout.on("data", (data) => console.log(data.toString()));
      ytDlpProcess.stderr.on("data", (data) => console.error(data.toString()));

      ytDlpProcess.on("close", (code) => {
        if (code === 0) {
          console.log("Download da playlist concluído. Zipando arquivos...");
          archive.directory(tempDir, false);
          archive.finalize();

          archive.on("end", () => {
            fs.rm(tempDir, { recursive: true, force: true }, (err) => {
              if (err) console.error("Erro ao remover pasta temporária:", err);
              else console.log("Pasta temporária removida.");
            });
          });
        } else {
          res
            .status(500)
            .send("Erro ao baixar a playlist. Verifique o console do backend.");
          fs.rm(tempDir, { recursive: true, force: true }, () => {});
        }
      });
    } else {
      const titleProcess = spawn("yt-dlp", [
        "--get-title",
        "-o",
        "%(title)s",
        url,
      ]);
      let videoTitle = "";
      for await (const chunk of titleProcess.stdout) {
        videoTitle += chunk.toString();
      }
      videoTitle = videoTitle
        .trim()
        .replace(/[^\x00-\x7F]/g, "")
        .replace(/[\/\\?%*:|"<>]/g, "_");

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${videoTitle || "audio"}.mp3"`
      );
      res.setHeader("Content-Type", "audio/mpeg");

      const ytDlpProcess = spawn("yt-dlp", [
        url,
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "-o",
        "-",
      ]);

      ytDlpProcess.stdout.pipe(res);

      ytDlpProcess.stderr.on("data", (data) =>
        console.error(`yt-dlp stderr: ${data}`)
      );
      ytDlpProcess.on("error", (err) =>
        res.status(500).send("Erro no processo yt-dlp.")
      );
    }
  } catch (error) {
    console.error("Erro geral:", error);
    res.status(500).send("Ocorreu um erro inesperado.");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Aberto para conexões na rede local na porta ${PORT}.`);
});
