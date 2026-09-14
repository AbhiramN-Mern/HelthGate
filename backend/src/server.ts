import http from "node:http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { initializeVideoSocket } from "./sockets/videoCall.socket.js";
import { videoCallService } from "./container.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const httpServer = http.createServer(app);

    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
        credentials: true,
      },
    });

    // Wire socket broadcaster into videoCallService for real-time notifications
    videoCallService.setSocketBroadcaster(
      (event: string, target: string, data: any) => {
        io.to(target).emit(event, data);
      },
    );

    // Initialize signaling & socket authentication
    initializeVideoSocket(io);

    httpServer.listen(PORT, () => {
      console.log(`Server running with Socket.IO on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

void startServer();
