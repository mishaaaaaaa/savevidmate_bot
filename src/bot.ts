import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
import fs from "fs";
import { createUser, updateUserStats } from "./supabase.js";
import { getVideoMetadata, downloadVideo } from "./utils.js";
import { VideoMetadata } from "./types.js";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN as string);

bot.start(async (ctx) => {
  const user = ctx.from;

  await createUser(user);

  ctx.reply(
    `Привіт, ${user.first_name}! Надішли мені посилання, і я спробую завантажити відео.`
  );
});

bot.help((ctx) =>
  ctx.reply(
    "Надішли мені посилання на відео з TikTok, Instagram, Twitter або YouTube Shorts."
  )
);

bot.on("text", async (ctx) => {
  const user = ctx.from;
  const url = ctx.message.text.trim();

  if (!url.startsWith("http")) {
    return ctx.reply("Надішли мені коректне посилання на відео.");
  }

  ctx.reply("🔍 Отримую інформацію про відео...");

  try {
    // Получаем метаданные видео
    const metadata: VideoMetadata | null = await getVideoMetadata(url);

    if (!metadata) {
      return ctx.reply("⚠️ Не вдалося отримати інформацію про відео.");
    }

    const isTikTok =
      url.includes("tiktok.com") || url.includes("vm.tiktok.com");
    const maxSize = 50 * 1024 * 1024; // 50MB
    const fileSizeInMb = metadata.fileSize
      ? Math.round(metadata.fileSize / 1024 / 1024)
      : null;

    if (fileSizeInMb !== null && metadata?.fileSize! > maxSize) {
      return ctx.reply(
        `❌ Відео занадто велике (${fileSizeInMb} MB). Ліміт: 50 MB.`
      );
    }

    console.log(
      `✅ Розмір відео: ${
        fileSizeInMb ? fileSizeInMb + " MB" : "невідомий"
      }. Завантажую...`
    );

    // Обновляем статистику пользователя
    if (fileSizeInMb !== null) {
      await updateUserStats(user.id, fileSizeInMb);
    }

    // Скачиваем видео
    const fileName = `video_${randomUUID()}.mp4`;
    await downloadVideo(fileName, url, isTikTok, metadata.formatId);

    // Отправляем видео
    await ctx.replyWithVideo({ source: fileName });

    // Удаляем файл после отправки
    fs.unlinkSync(fileName);
  } catch (error) {
    console.error("❌ Ошибка обработки видео:", error);
    ctx.reply("⚠️ Виникла помилка при обробці відео.");
  }
});

bot.launch();
console.log("🚀 Бот запущен!");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
