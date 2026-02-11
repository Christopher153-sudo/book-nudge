"""
BookNudge — A fun book reading reminder app 📚
"""

import os
import json
import random
import sqlite3
from datetime import datetime, date
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'booknudge.db')

# ── Fun motivational quotes ──────────────────────────────────────────

QUOTES = [
    {"text": "A reader lives a thousand lives before he dies. The man who never reads lives only one.", "author": "George R.R. Martin", "emoji": "🐉"},
    {"text": "So many books, so little time.", "author": "Frank Zappa", "emoji": "⏰"},
    {"text": "Reading is dreaming with open eyes.", "author": "Anissa Trisdianty", "emoji": "✨"},
    {"text": "Books are a uniquely portable magic.", "author": "Stephen King", "emoji": "🪄"},
    {"text": "One more chapter… said every reader ever.", "author": "Anonymous", "emoji": "😅"},
    {"text": "Reading gives us someplace to go when we have to stay where we are.", "author": "Mason Cooley", "emoji": "🚀"},
    {"text": "I declare after all there is no enjoyment like reading!", "author": "Jane Austen", "emoji": "💃"},
    {"text": "Think before you speak. Read before you think.", "author": "Fran Lebowitz", "emoji": "🧠"},
    {"text": "If you don't like to read, you haven't found the right book.", "author": "J.K. Rowling", "emoji": "⚡"},
    {"text": "A book is a dream you hold in your hands.", "author": "Neil Gaiman", "emoji": "🌙"},
    {"text": "Today a reader, tomorrow a leader.", "author": "Margaret Fuller", "emoji": "👑"},
    {"text": "We read to know we are not alone.", "author": "C.S. Lewis", "emoji": "🤝"},
    {"text": "Your bookshelf is judging you right now.", "author": "BookNudge", "emoji": "👀"},
    {"text": "That book isn't going to read itself, you know.", "author": "BookNudge", "emoji": "📖"},
    {"text": "Netflix can wait. Your book misses you.", "author": "BookNudge", "emoji": "📺"},
    {"text": "Plot twist: you actually read today!", "author": "BookNudge", "emoji": "🎉"},
]

# ── Database helpers ─────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT DEFAULT '',
                reminder_time TEXT DEFAULT '09:00',
                streak INTEGER DEFAULT 0,
                best_streak INTEGER DEFAULT 0,
                last_read TEXT DEFAULT '',
                total_days_read INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
        ''')
        conn.commit()


# ── Routes ───────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/books', methods=['GET'])
def get_books():
    with get_db() as conn:
        books = conn.execute('SELECT * FROM books ORDER BY created_at DESC').fetchall()
        return jsonify([dict(b) for b in books])


@app.route('/api/books', methods=['POST'])
def add_book():
    data = request.get_json()
    title = data.get('title', '').strip()
    author = data.get('author', '').strip()
    reminder_time = data.get('reminder_time', '09:00').strip()

    if not title:
        return jsonify({"error": "Title is required!"}), 400

    with get_db() as conn:
        cursor = conn.execute(
            'INSERT INTO books (title, author, reminder_time) VALUES (?, ?, ?)',
            (title, author, reminder_time)
        )
        conn.commit()
        book = conn.execute('SELECT * FROM books WHERE id = ?', (cursor.lastrowid,)).fetchone()
        return jsonify(dict(book)), 201


@app.route('/api/books/<int:book_id>', methods=['PUT'])
def update_book(book_id):
    data = request.get_json()
    title = data.get('title', '').strip()
    author = data.get('author', '').strip()
    reminder_time = data.get('reminder_time', '09:00').strip()

    if not title:
        return jsonify({"error": "Title is required!"}), 400

    with get_db() as conn:
        conn.execute(
            'UPDATE books SET title = ?, author = ?, reminder_time = ? WHERE id = ?',
            (title, author, reminder_time, book_id)
        )
        conn.commit()
        book = conn.execute('SELECT * FROM books WHERE id = ?', (book_id,)).fetchone()
        if not book:
            return jsonify({"error": "Book not found"}), 404
        return jsonify(dict(book))


@app.route('/api/books/<int:book_id>', methods=['DELETE'])
def delete_book(book_id):
    with get_db() as conn:
        conn.execute('DELETE FROM books WHERE id = ?', (book_id,))
        conn.commit()
    return jsonify({"message": "Book removed! 📚 Hope you finished it first…"}), 200


@app.route('/api/books/<int:book_id>/read', methods=['POST'])
def mark_read(book_id):
    today = date.today().isoformat()

    with get_db() as conn:
        book = conn.execute('SELECT * FROM books WHERE id = ?', (book_id,)).fetchone()
        if not book:
            return jsonify({"error": "Book not found"}), 404

        book = dict(book)

        # Already marked today
        if book['last_read'] == today:
            return jsonify({**book, "message": "You already read today! 🌟 Overachiever!"}), 200

        # Check if streak continues (last_read was yesterday)
        yesterday = date.today().toordinal() - 1
        if book['last_read']:
            try:
                last = date.fromisoformat(book['last_read']).toordinal()
                if last == yesterday:
                    new_streak = book['streak'] + 1
                else:
                    new_streak = 1
            except ValueError:
                new_streak = 1
        else:
            new_streak = 1

        best_streak = max(book['best_streak'], new_streak)
        total_days = book['total_days_read'] + 1

        conn.execute(
            'UPDATE books SET streak = ?, best_streak = ?, last_read = ?, total_days_read = ? WHERE id = ?',
            (new_streak, best_streak, today, total_days, book_id)
        )
        conn.commit()

        updated = conn.execute('SELECT * FROM books WHERE id = ?', (book_id,)).fetchone()
        result = dict(updated)

        # Fun response messages
        messages = [
            f"🎉 Day {new_streak}! Keep the streak alive!",
            f"📖 {new_streak} days strong! You're on fire! 🔥",
            f"✨ Reading streak: {new_streak}! Your bookshelf is proud.",
            f"🏆 {new_streak}-day streak! Almost a habit now!",
            f"🌟 {total_days} total days read! Legend status incoming!",
        ]
        result['message'] = random.choice(messages)
        return jsonify(result), 200


@app.route('/api/quote', methods=['GET'])
def get_quote():
    return jsonify(random.choice(QUOTES))


# ── Entry point ──────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
