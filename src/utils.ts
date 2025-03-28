import { exec } from "child_process";
import { ytDlpCommands } from "./commands.js";
import { VideoMetadata } from "./types.js";

export const getVideoMetadata = (
  url: string
): Promise<VideoMetadata | null> => {
  return new Promise((resolve) => {
    exec(ytDlpCommands.analyzeVideo(url), (error, stdout, stderr) => {
      if (error || stderr) {
        console.error(
          "❌ Помилки при отриманні інформації про відео:",
          error || stderr
        );
        return resolve(null);
      }

      try {
        const metadata = JSON.parse(stdout);
        const formatId = metadata.format_id;
        const fileSize = metadata.filesize ?? metadata.filesize_approx ?? null;
        resolve({ formatId, fileSize });
      } catch (parseError) {
        console.error("❌ Помилка парсинга JSON:", parseError);
        resolve(null);
      }
    });
  });
};

export const downloadVideo = (
  fileName: string,
  url: string,
  isTikTok: boolean,
  formatId?: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const command = ytDlpCommands.download(
      fileName,
      url,
      isTikTok ? formatId : undefined
    );
    exec(command, (error, stdout, stderr) => {
      console.log(stdout);
      if (error || stderr) {
        console.error(
          `❌ Помилка завантаження відео: ${error?.message || stderr}`
        );
        return reject(error);
      }
      resolve();
    });
  });
};
