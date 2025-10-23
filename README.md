# Imposter Game (Web-Based)

A simple, real-time web implementation of the classic social deduction "imposter game" (similar to Spyfall or The Resistance). This application is designed to handle game creation, role assignment, and word distribution for remote gameplay.

## Overview

The Imposter Game is a lightweight full-stack application that manages player roles and secret word knowledge. Players connect to unique rooms and must deduce who the Imposter is based on their conversation about a shared secret word.

## Key Features

* **Real-Time Multiplayer:** Facilitates multiple players joining a game via a unique room code.
* **Role Management:** Automatic and random assignment of the Imposter role.
* **Word Distribution:** Assigns a secret word to all regular players while concealing it from the Imposter.
* **Minimal Interface:** Clean design focused on essential game information.

## Tech

This project is built using standard web technologies:

* **Frontend:** HTML, CSS, and Vanilla JavaScript.
* **Backend:** Node.js with the Express.js framework.
* **Data:** `wordlist.json` file for game vocabulary.

## Project Structure

The key files in this repository are:

* `server.js`: The main backend file using Node.js/Express to handle game logic and routing.
* `public/`: Contains the static frontend files (HTML, CSS, JavaScript).
* `wordlist.json`: The dictionary used for selecting secret words.

## Deployment

This application is set up for deployment on a platform that supports Node.js (e.g., Heroku, Render, Vercel with a custom server). The included `package.json` specifies necessary server dependencies.
