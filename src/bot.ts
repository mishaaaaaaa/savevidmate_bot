import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { supabase } from "./supabase.js";
import { ytDlpCommands } from "./utils.js";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN as string);

bot.start(async (ctx) => {
  const user = ctx.from;

  const { error } = await supabase.from("users").upsert([
    {
      telegram_id: user.id,
      username: user.username,
      first_name: user.first_name,
      language_code: user.language_code,
      is_premium: user.is_premium ?? false,
    },
  ]);

  if (error) {
    console.error("❌ Ошибка при сохранении пользователя:", error);
  }

  ctx.reply(
    `Привіт, ${user.first_name}! Надішли мені посилання, і я спробую завантажити відео.`
  );
});

bot.help((ctx) =>
  ctx.reply(
    "Просто надішли мені посилання на відео з TikTok, Twitter або YouTube Shorts."
  )
);

bot.on("text", async (ctx) => {
  const user = ctx.from;
  const url = ctx.message.text;

  if (!url.startsWith("http")) {
    return ctx.reply("Надішли мені коректне посилання на відео.");
  }

  ctx.reply("Обробляю посилання...");

  const fileName = `video_${randomUUID()}.mp4`;

  // Команда для загрузки видео

  const command = ytDlpCommands.default(fileName, url);

  // здесь получениея размера видео и его логирование

  // await exec(ytDlpCommands.analyzeVideo(url), async (error, stdout, stderr) => {
  //   if (error || stderr) {
  //     console.error("❌ Ошибка получения информации о видео:", error || stderr);
  //     return ctx.reply("⚠️ Не вдалося отримати інформацію про відео.");
  //   }

  //   const metadata = JSON.parse(stdout);
  //   const fileSize = metadata.filesize ?? metadata.filesize_approx ?? 0; // Размер в байтах
  //   const maxSize = 50 * 1024 * 1024; // 50MB

  //   if (fileSize > maxSize) {
  //     return ctx.reply(
  //       `❌ Відео занадто велике (${(fileSize / 1024 / 1024).toFixed(
  //         2
  //       )} MB). Ліміт: 50 MB.`
  //     );
  //   }

  //   ctx.reply(
  //     `✅ Розмір відео: ${(fileSize / 1024 / 1024).toFixed(
  //       2
  //     )} MB. Завантажую...`
  //   );
  // });

  exec(command, async (error, stdout, stderr) => {
    console.log(stdout);
    if (error) {
      console.error(`❌ Ошибка: ${error.message}`);
      return ctx.reply("Не вдалося завантажити відео.");
    }
    if (stderr) console.error(`⚠️ STDERR: ${stderr}`);

    if (fs.existsSync(fileName)) {
      await ctx.replyWithVideo({ source: fileName });

      // Удаляем файл после отправки
      fs.unlink(fileName, (err) => {
        if (err) console.error(`⚠️ Ошибка удаления файла: ${err.message}`);
      });

      const { data, error } = await supabase
        .from("users")
        .select("downloads")
        .eq("telegram_id", user.id)
        .single();

      if (error || !data) {
        console.error("❌ Ошибка при получении количества скачиваний:", error);
      } else {
        // Увеличиваем downloads на 1
        const newDownloads = (data.downloads ?? 0) + 1;

        const { error: updateError } = await supabase
          .from("users")
          .update({ downloads: newDownloads })
          .eq("telegram_id", user.id);

        if (updateError) {
          console.error(
            "❌ Ошибка при обновлении количества скачиваний:",
            updateError
          );
        } else {
          console.log(`✅ Количество скачиваний обновлено: ${newDownloads}`);
        }
      }
    } else {
      ctx.reply("❌ Помилка: файл відео не знайдено після завантаження.");
    }
  });
});

// Запуск бота
bot.launch();
console.log("🚀 Бот запущен!");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
