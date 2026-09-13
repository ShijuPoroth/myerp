# MWH Management — Server & Deployment Guide

> Complete step-by-step guide for connecting to your server, pushing updates, and managing the app.

---

## Table of Contents

1. [Connecting to Your Server](#1-connecting-to-your-server)
2. [Navigating the Server](#2-navigating-the-server)
3. [PM2 Process Management](#3-pm2-process-management)
4. [Pushing Updates from Your PC](#4-pushing-updates-from-your-pc)
5. [Pulling Updates on the Server](#5-pulling-updates-on-the-server)
6. [Clearing Cloudflare Cache](#6-clearing-cloudflare-cache)
7. [Testing After Deployment](#7-testing-after-deployment)
8. [Viewing Server Logs](#8-viewing-server-logs)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Connecting to Your Server

Your server is an Ubuntu machine. You connect to it using SSH (Secure Shell).

### Using Windows Terminal / PowerShell / Command Prompt

```bash
ssh root@YOUR_SERVER_IP
```

Replace `YOUR_SERVER_IP` with your server's IP address (e.g., `123.45.67.89`).

- It will ask for your password. Type it (characters won't show on screen — this is normal).
- Press Enter.
- Once connected, you'll see a prompt like `root@server:~#`.

### Using PuTTY (alternative)

1. Download PuTTY from https://putty.org
2. Open PuTTY
3. Enter your server IP in "Host Name"
4. Port: 22
5. Click "Open"
6. Enter username: `root`
7. Enter your password

---

## 2. Navigating the Server

Once you're connected via SSH, here are the basic commands:

### Go to your project folder

```bash
cd /www/wwwroot/opsmaster.net/MWH_Management
```

### List files in the folder

```bash
ls -la
```

### Check if you're in the right place

```bash
pwd
```
(This prints the current directory path. It should show `/www/wwwroot/opsmaster.net/MWH_Management`)

---

## 3. PM2 Process Management

PM2 is the process manager that keeps your Node.js app running.

### Check if the app is running

```bash
pm2 status
```

You should see a process named `mwh-erp` with status `online`.

### Restart the app (after pulling updates)

```bash
pm2 restart mwh-erp
```

Or restart all PM2 processes:

```bash
pm2 restart all
```

### Stop the app

```bash
pm2 stop mwh-erp
```

### Start the app

```bash
pm2 start server.js --name mwh-erp
```

### View real-time logs

```bash
pm2 logs mwh-erp
```

Press `Ctrl+C` to exit the log view.

### Save PM2 process list (so it auto-restarts on reboot)

```bash
pm2 save
pm2 startup
```
(Follow the instructions PM2 prints after `startup` if it's the first time.)

---

## 4. Pushing Updates from Your PC

This is done on your local Windows computer (NOT on the server).

### Step 1: Open a terminal in your project folder

- Open VS Code or Windows Terminal
- Navigate to your project folder:

```bash
cd "C:\Users\SHIJU\Desktop\MWH Management"
```

### Step 2: Check what files changed

```bash
git status
```

This shows:
- Red files = modified but not staged
- Green files = staged and ready to commit

### Step 3: Stage all changes

```bash
git add -A
```

This stages ALL modified, new, and deleted files.

### Step 4: Commit with a message

```bash
git commit -m "Describe what you changed here"
```

Example:
```bash
git commit -m "Updated CSP security headers and added custom.css"
```

### Step 5: Push to GitHub

```bash
git push
```

This uploads your changes to the remote Git repository.

### All-in-one command (quick version)

```bash
git add -A && git commit -m "your message here" && git push
```

---

## 5. Pulling Updates on the Server

After you've pushed from your PC, connect to the server via SSH and pull the changes.

### Step 1: Connect to server

```bash
ssh root@YOUR_SERVER_IP
```

### Step 2: Go to project folder

```bash
cd /www/wwwroot/opsmaster.net/MWH_Management
```

### Step 3: Pull the latest changes

```bash
git pull
```

You should see something like:
```
Updating abc1234..def5678
Fast-forward
 server.js | 5 +++--
 1 file changed, 4 insertions(+), 1 deletion(-)
```

### Step 4: Restart the app

```bash
pm2 restart mwh-erp
```

### Step 5: Verify it's running

```bash
pm2 status
```

### All-in-one command (quick version)

```bash
cd /www/wwwroot/opsmaster.net/MWH_Management && git pull && pm2 restart mwh-erp
```

---

## 6. Clearing Cloudflare Cache

After deploying changes, you need to clear Cloudflare's cache so visitors see the latest version.

### Step 1: Log in to Cloudflare

1. Go to https://dash.cloudflare.com
2. Log in with your Cloudflare account
3. Select your domain (`opsmaster.net`)

### Step 2: Purge Cache

1. On the left sidebar, click **Caching** → **Configuration**
2. Click the **Purge Everything** button
3. Confirm by clicking **Purge**

### Alternative: Purge by URL

If you only changed specific files:
1. Click **Custom Purge**
2. Enter the URLs, e.g.:
   - `https://opsmaster.net/app`
   - `https://opsmaster.net/css/custom.css`
3. Click **Purge**

---

## 7. Testing After Deployment

### Always test in a Private/Incognito window

This avoids cached old versions in your browser.

### In Chrome/Edge:
- Press `Ctrl+Shift+N` to open Incognito/Private window
- Go to `https://opsmaster.net`
- Open Developer Tools (`F12`) → Console tab
- Check for errors

### In Firefox:
- Press `Ctrl+Shift+P` to open Private window
- Go to `https://opsmaster.net`
- Open Developer Tools (`F12`) → Console tab
- Check for errors

### What's normal to see:
- Font Awesome "glyph bbox" warnings — **harmless**
- CSS vendor prefix warnings (`-moz-column-gap`, etc.) — **harmless**
- Cloudflare challenge XHR POST — **harmless** (bot protection)

### What's NOT normal:
- Red error messages
- CSP violation errors
- Failed network requests (red in Network tab)

---

## 8. Viewing Server Logs

### PM2 application logs (your Node.js app output)

```bash
pm2 logs mwh-erp
```

Press `Ctrl+C` to exit.

### Last 100 lines of logs

```bash
pm2 logs mwh-erp --lines 100
```

### Error logs only

```bash
pm2 logs mwh-erp --err
```

### Clear logs

```bash
pm2 flush mwh-erp
```

### Nginx logs (if applicable)

```bash
tail -50 /www/wwwlogs/opsmaster.net.log
tail -50 /www/wwwlogs/opsmaster.net.error.log
```

---

## 9. Troubleshooting

### App is not responding

1. Check PM2 status:
   ```bash
   pm2 status
   ```
2. If `errored` or `stopped`, restart:
   ```bash
   pm2 restart mwh-erp
   ```
3. Check logs for errors:
   ```bash
   pm2 logs mwh-erp --lines 50
   ```

### Git pull says "Your local changes would be overwritten"

If you made changes directly on the server (you shouldn't), reset them:

```bash
git checkout .
git pull
```

### Git pull says "fatal: not a git repository"

You're in the wrong folder. Make sure:
```bash
cd /www/wwwroot/opsmaster.net/MWH_Management
```

### Port 3000 already in use

Find and kill the process:
```bash
lsof -i :3000
kill -9 <PID>
pm2 restart mwh-erp
```

### Cloudflare still serving old content

1. Purge cache in Cloudflare dashboard
2. Wait 30 seconds
3. Test in incognito window
4. If still old, restart the app: `pm2 restart mwh-erp`

### Forgot server password

Contact your hosting provider to reset the root password.

---

## Quick Reference Card

| Action | Command |
|---|---|
| Connect to server | `ssh root@YOUR_SERVER_IP` |
| Go to project | `cd /www/wwwroot/opsmaster.net/MWH_Management` |
| Pull updates | `git pull` |
| Restart app | `pm2 restart mwh-erp` |
| Check status | `pm2 status` |
| View logs | `pm2 logs mwh-erp` |
| Full deploy (server) | `cd /www/wwwroot/opsmaster.net/MWH_Management && git pull && pm2 restart mwh-erp` |
| Full deploy (local PC) | `git add -A && git commit -m "message" && git push` |

---

> **Remember:** Always test in a private/incognito window after deploying. Always purge Cloudflare cache after deploying.
