import mysql from "mysql2/promise";
import "dotenv/config";
import { readFile } from "fs/promises";

const connection = await mysql.createConnection({
    host: "localhost",
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
});


export default connection;
