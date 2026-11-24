require("dotenv").config();
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { sequelize } = require("./models");
const errorHandler = require("./middleware/errorHandler");
const AppError = require("./utils/appError");
const { initializeSocket } = require("./socket");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.ADMIN_URL,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
].filter(Boolean);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin(origin, cb) {
      // allow non-browser / same-origin
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, true); // permissive for local SSR proxies
    },
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("trust proxy", 1);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/health", (req, res) =>
  res.json({ status: "ok", time: new Date().toISOString() }),
);

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/banners", require("./routes/bannerRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/files", require("./routes/fileRoutes"));
app.use("/api/attributes", require("./routes/attributeRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/my-orders", require("./routes/userOrderRoutes"));
app.use(
  "/api/admin/notifications",
  require("./routes/adminNotificationRoutes"),
);
app.all("*", (req, res, next) =>
  next(new AppError(`Not found: ${req.originalUrl}`, 404)),
);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
sequelize
  .authenticate()
  .then(async () => {
    console.log("DB connected successfully");
    const io = await initializeSocket(server);
    io.on("connection", async (socket) => {
      // console.log(socket.handshake);
      const userId = socket.handshake.auth.userId;
      const normalizedUserId = userId;

      console.log(
        `User with ID ${normalizedUserId} connected with ${socket.id}`,
      );

      socket.join(normalizedUserId);

      socket.on("disconnect", async () => {
        console.log(`Client disconnected ${normalizedUserId}: ${socket.id}`);
      });
    });
    server.listen(PORT, () => console.log(`Server listened on port ${PORT}`));
  })
  .catch((e) => {
    console.error("DB connection failed", e);
    process.exit(1);
  });
