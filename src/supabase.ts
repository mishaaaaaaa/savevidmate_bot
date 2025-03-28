import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { User } from "telegraf/types";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

export { supabase };

export const createUser = async (user: User) => {
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
    console.error("❌ Помилка при збереженні користувача:", error);
  }
};

export const updateUserStats = async (
  telegramId: number,
  fileSizeInMb: number
) => {
  const { data, error } = await supabase
    .from("users")
    .select("downloads, total_downloads_size")
    .eq("telegram_id", telegramId)
    .single();

  if (error || !data) {
    console.error("❌ Помилка при отриманні даних користувача:", error);
    return;
  }

  const newDownloads = (data.downloads ?? 0) + 1;
  const newTotalSize = (data.total_downloads_size ?? 0) + fileSizeInMb;

  await supabase
    .from("users")
    .update({ downloads: newDownloads, total_downloads_size: newTotalSize })
    .eq("telegram_id", telegramId);
};
