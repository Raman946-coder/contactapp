# 📱 Secure Smart Contact Manager

A full-stack, cloud-hosted contact management system featuring secure user authentication, private data storage, and a responsive modern UI.

## 🚀 Live Demo
- **Frontend:** [https://raman946-coder.github.io/contactapp/](https://raman946-coder.github.io/contactapp/)
- **Backend API:** Hosted on Render

## ✨ Key Features
- **User Authentication:** Secure Signup and Login using JWT (JSON Web Tokens).
- **Private Contacts:** Users only see and manage the contacts they have created.
- **Full CRUD:** Create, Read, Update, and Delete contacts seamlessly.
- **Cloud Database:** Powered by a managed Aiven MySQL instance.
- **Mobile Responsive:** Custom CSS Flexbox architecture that adapts to any screen size (Desktop, Tablet, Mobile).
- **Security First:**
  - Passwords are encrypted using **Bcrypt.js** before storage.
  - API routes are protected by middleware to verify session tokens.
  - Environment variables keep database credentials private.

## 🛠️ Technology Stack
| Layer | Technology |
| :--- | :--- |
| **Frontend** | HTML5, CSS3 (Mobile-First), JavaScript (ES6) |
| **Backend** | Node.js, Express.js |
| **Database** | MySQL (Hosted on Aiven Cloud) |
| **Auth** | JWT (JSON Web Tokens), Bcrypt.js |
| **Hosting** | GitHub Pages (Frontend), Render (API) |

## 🏗️ Project Architecture
This project demonstrates a modern cloud-distributed architecture:
1. **The Client:** A static frontend hosted on GitHub Pages.
2. **The Server:** A RESTful API built with Express and hosted on Render.
3. **The Database:** A relational database managed on Aiven Cloud.

## 🛠️ Installation & Setup
To run this project locally:

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/raman946-coder/contactapp.git](https://github.com/raman946-coder/contactapp.git)