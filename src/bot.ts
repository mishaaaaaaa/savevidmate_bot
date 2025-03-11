import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN as string);

bot.start((ctx) =>
  ctx.reply("Привіт! Надішли мені посилання, і я спробую завантажити відео.")
);
bot.help((ctx) =>
  ctx.reply(
    "Просто надішли мені посилання на відео з TikTok, Twitter або YouTube Shorts."
  )
);

bot.on("text", async (ctx) => {
  const url = ctx.message.text;

  if (!url.startsWith("http")) {
    return ctx.reply("Надішли мені коректне посилання на відео.");
  }

  ctx.reply("Обробляю посилання...");

  const fileName = `video_${randomUUID()}.mp4`;

  // Правильна команда для завантаження відео
  const command = `yt-dlp --no-warnings -S ext:mp4:m4a --merge-output-format mp4 -o "${fileName}" "${url}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Помилка: ${error.message}`);
      return ctx.reply("Не вдалося завантажити відео.");
    }
    if (stderr) console.error(`STDERR: ${stderr}`);

    // Перевіряємо, чи існує файл перед відправкою
    if (fs.existsSync(fileName)) {
      ctx.replyWithVideo({ source: fileName }).then(() => {
        // Видаляємо файл після відправки
        fs.unlink(fileName, (err) => {
          if (err) console.error(`Помилка видалення файлу: ${err.message}`);
        });
      });
    } else {
      ctx.reply("Помилка: файл відео не знайдено після завантаження.");
    }
  });
});

bot.launch();

console.log("Бот запущений!");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
