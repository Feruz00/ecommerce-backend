"use strict";
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const hash = await bcrypt.hash("test12345", 12);

    await queryInterface.bulkInsert("tbl_users", [
      {
        id: uuidv4(),
        first_name: "Admin",
        last_name: "User",
        username: "admin",
        phone: "+99361000001",
        password: hash,
        role: "admin",
        status: "active",
        preferred_lang: "en",
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        first_name: "Manager",
        last_name: "User",
        username: "manager",
        phone: "+99361000002",
        password: hash,
        role: "manager",
        status: "active",
        preferred_lang: "tm",
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        first_name: "Customer",
        last_name: "Demo",
        username: "user",
        phone: "+99361000003",
        password: hash,
        role: "customer",
        status: "active",
        preferred_lang: "ru",
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("tbl_users", null, {});
  },
};
