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

  ctx.reply("🔍 Отримую інформацію про відео...");

  const isTikTok = url.includes("tiktok.com") || url.includes("vm.tiktok.com");

  console.log(isTikTok);

  if (isTikTok) {
    exec(ytDlpCommands.listFormats(url), async (error, stdout, stderr) => {
      if (error || stderr) {
        console.error("❌ Ошибка получения форматов:", error || stderr);
        return ctx.reply(
          "⚠️ Не вдалося отримати інформацію про формати відео."
        );
      }

      try {
        // Фильтруем форматы, оставляя только h264 без watermarked
        const formats = stdout
          .split("\n")
          .filter(
            (line) => line.includes("h264") && !line.includes("watermarked")
          );

        if (formats.length === 0) {
          return ctx.reply("⚠️ Не вдалося знайти відповідний формат відео.");
        }

        // Выбираем формат с наибольшим битрейтом (TBR)
        const bestFormat = formats.reduce(
          (max, line) => {
            const match = line.match(/(\d+)k/); // Ищем битрейт в строке
            const bitrate = match ? parseInt(match[1], 10) : 0;
            return bitrate > max.bitrate ? { line, bitrate } : max;
          },
          { line: "", bitrate: 0 }
        );

        if (!bestFormat.line) {
          return ctx.reply("⚠️ Не вдалося знайти підходящий формат.");
        }

        const formatId = bestFormat.line.split(" ")[0]; // Получаем ID формата
        console.log(`📜 Вибрано найкращий формат: ${formatId}`);

        // После выбора формата проверяем размер видео
        exec(ytDlpCommands.analyzeVideo(url), async (error, stdout, stderr) => {
          if (error || stderr) {
            console.error(
              "❌ Ошибка получения информации о видео:",
              error || stderr
            );
            return ctx.reply("⚠️ Не вдалося отримати інформацію про відео.");
          }

          try {
            const metadata = JSON.parse(stdout);
            const fileSize = metadata.filesize ?? metadata.filesize_approx ?? 0;
            const maxSize = 50 * 1024 * 1024; // 50MB
            const fileSizeInMb = Math.round(fileSize / 1024 / 1024);

            if (fileSize === 0) {
              return ctx.reply("⚠️ Не вдалося визначити розмір відео.");
            }

            if (fileSize > maxSize) {
              return ctx.reply(
                `❌ Відео занадто велике (${fileSizeInMb} MB). Ліміт: 50 MB.`
              );
            }

            console.log(`✅ Розмір відео: ${fileSizeInMb} MB. Завантажую...`);

            // Обновляем статистику пользователя
            const { data, error } = await supabase
              .from("users")
              .select("downloads, total_downloads_size")
              .eq("telegram_id", user.id)
              .single();

            if (error || !data) {
              console.error(
                "❌ Ошибка при получении данных пользователя:",
                error
              );
            } else {
              const newDownloads = (data.downloads ?? 0) + 1;
              const newTotalSize =
                (data.total_downloads_size ?? 0) + fileSizeInMb;

              const { error: updateError } = await supabase
                .from("users")
                .update({
                  downloads: newDownloads,
                  total_downloads_size: newTotalSize,
                })
                .eq("telegram_id", user.id);

              if (updateError) {
                console.error(
                  "❌ Ошибка при обновлении данных пользователя:",
                  updateError
                );
              } else {
                console.log(
                  `✅ Обновлено: скачиваний - ${newDownloads}, общий размер - ${newTotalSize} MB`
                );
              }
            }

            // Скачиваем видео
            const fileName = `video_${randomUUID()}.mp4`;
            const command = ytDlpCommands.tikTok(fileName, url, formatId);

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
                  if (err)
                    console.error(`⚠️ Ошибка удаления файла: ${err.message}`);
                });
              } else {
                ctx.reply(
                  "❌ Помилка: файл відео не знайдено після завантаження."
                );
              }
            });
          } catch (parseError) {
            console.error("❌ Ошибка парсинга JSON:", parseError);
            ctx.reply("⚠️ Виникла помилка при обробці відео.");
          }
        });
      } catch (parseError) {
        console.error("❌ Ошибка парсинга списка форматов:", parseError);
        ctx.reply("⚠️ Виникла помилка при виборі формату.");
      }
    });
  } else {
    exec(ytDlpCommands.analyzeVideo(url), async (error, stdout, stderr) => {
      if (error || stderr) {
        console.error(
          "❌ Ошибка получения информации о видео:",
          error || stderr
        );
        return ctx.reply("⚠️ Не вдалося отримати інформацію про відео.");
      }

      try {
        const metadata = JSON.parse(stdout);
        const maxSize = 50 * 1024 * 1024; // 50MB

        // Проверяем, есть ли информация о размере файла
        let fileSize = metadata.filesize ?? metadata.filesize_approx;
        let fileSizeInMb = fileSize ? Math.round(fileSize / 1024 / 1024) : null;

        if (!fileSizeInMb) {
          console.warn(
            "⚠️ Не вдалося визначити розмір відео. Завантажуємо без перевірки..."
          );
        } else if (fileSize > maxSize) {
          return ctx.reply(
            `❌ Відео занадто велике (${fileSizeInMb} MB). Ліміт: 50 MB.`
          );
        }

        console.log(
          `✅ Розмір відео: ${
            fileSizeInMb ? fileSizeInMb + " MB" : "невідомий"
          }. Завантажую...`
        );

        // Обновляем статистику пользователя (если размер известен)
        if (fileSizeInMb) {
          const { data, error } = await supabase
            .from("users")
            .select("downloads, total_downloads_size")
            .eq("telegram_id", user.id)
            .single();

          if (error || !data) {
            console.error(
              "❌ Ошибка при получении данных пользователя:",
              error
            );
          } else {
            const newDownloads = (data.downloads ?? 0) + 1;
            const newTotalSize =
              (data.total_downloads_size ?? 0) + fileSizeInMb;

            const { error: updateError } = await supabase
              .from("users")
              .update({
                downloads: newDownloads,
                total_downloads_size: newTotalSize,
              })
              .eq("telegram_id", user.id);

            if (updateError) {
              console.error(
                "❌ Ошибка при обновлении данных пользователя:",
                updateError
              );
            } else {
              console.log(
                `✅ Обновлено: скачиваний - ${newDownloads}, общий размер - ${newTotalSize} MB`
              );
            }
          }
        }

        // Скачиваем видео
        const fileName = `video_${randomUUID()}.mp4`;
        const command = ytDlpCommands.default(fileName, url);

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
              if (err)
                console.error(`⚠️ Ошибка удаления файла: ${err.message}`);
            });
          } else {
            ctx.reply("❌ Помилка: файл відео не знайдено після завантаження.");
          }
        });
      } catch (parseError) {
        console.error("❌ Ошибка парсинга JSON:", parseError);
        ctx.reply("⚠️ Виникла помилка при обробці відео.");
      }
    });
  }
});

// Запуск бота
bot.launch();
console.log("🚀 Бот запущен!");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
