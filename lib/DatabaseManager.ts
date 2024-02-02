import sqlite3 from 'sqlite3';
import fs from "fs";

class DatabaseManager {

    private db!: sqlite3.Database;

    constructor(databaseName: string) {
        const dbDir = 'db';
        try {
            fs.accessSync(dbDir, fs.constants.F_OK);
        } catch (err) {
            fs.mkdirSync(dbDir);
        }
        this.db = new sqlite3.Database(databaseName);
        this.initializeDatabase();
    }

    public saveObject(obj: any): void {
        this.db.run('INSERT INTO my_table (data) VALUES (?)', [JSON.stringify(obj)], function (err) {
            if (err) {
                console.error('Error inserting data:', err.message);
            }
        });
    }

    public loadObject(callback: (obj: any | null) => void): void {
        this.db.get('SELECT data FROM my_table ORDER BY id DESC LIMIT 1', function (err, row: any) {
            if (err) {
                console.error('Error retrieving data:', err.message);
                callback(null);
            } else {
                if (row) {
                    const loadedObject = JSON.parse(row.data);
                    callback(loadedObject);
                } else {
                    callback(null);
                }
            }
        });
    }


    public closeConnection(): void {
        this.db.close();
    }

    private initializeDatabase() {
        this.db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='my_table'", (err, row) => {
            if (err) {
                console.error('Error checking table existence:', err.message);
            } else {
                if (!row) {
                    this.createTable();
                }
            }
        });
    }

    private createTable() {
        this.db.run('CREATE TABLE my_table (id INTEGER PRIMARY KEY, data TEXT)', function (err) {
            if (err) {
                console.error('Error creating table:', err.message);
            }
        });
    }
}

const dbManager = new DatabaseManager('./db/db.sqlite');

export default dbManager
