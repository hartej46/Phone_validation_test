import { createApp } from "./app.js";
import { config } from "./config.js";
import { getRedisClient, createRedisStorageAdapter } from "./redis.js";

async function startServer() {
  try {
    const redis = await getRedisClient();
    const storageAdapter = createRedisStorageAdapter(redis);
    const app = createApp(redis, storageAdapter);

    app.listen(config.port, () => {
      console.log(`🚀 Angelos Auth Backend listening on http://localhost:${config.port}`);
      console.log(`📱 WhatsApp Business Number: ${config.whatsappBusinessNumber || "Not configured"}`);
      console.log(`🌐 Allowed Client URL: ${config.clientUrl}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
