import mysql from "mysql2/promise";
import "dotenv/config";

const host = process.env.ENV === "PROD" ?
    process.env.MYSQL_HOST_PROD : process.env.MYSQL_HOST_DEV;

const connection = mysql.createPool({
    host,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
});

export default connection;
