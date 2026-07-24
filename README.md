# Pixel Plates

Pixel Plates is a restaurant operations system for tablets on a restaurant's local network. The root `server.js` is the active application; the old `backend/` experiment is not used.

## First-time setup

1. Start MySQL from XAMPP.
2. Import `DATABASE/pixel_plates.sql` through phpMyAdmin.
3. In `.env`, set the MySQL credentials and a long random `JWT_SECRET`.
4. Add `SEED_RESTAURANT_NAME`, `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD` to `.env`.
5. Run `npm install`, then `npm run seed`, then `npm start` from the project root.
6. Sign in as the seeded administrator and create waiter and kitchen accounts under Staff.

Do not start `backend/server.js`; it is an obsolete prototype and also attempts to use port 3000.

## Use on restaurant tablets

Connect the server computer and tablets to the same private Wi-Fi. Find the computer's IPv4 address with `ipconfig`, allow Node.js/port 3000 through Windows Firewall for private networks, and open `http://SERVER_IP:3000` on each tablet. Reserve the server computer's IP address in the router so the address does not change.

For a production installation, use HTTPS, a reverse proxy, automated database backups, a dedicated MySQL account, and a managed device shortcut or kiosk browser on each tablet.

## Roles

- **Admin:** order desk, kitchen board, menu and inventory, staff accounts.
- **Waiter:** create table orders using the live menu.
- **Kitchen:** view tickets and move them through New, Preparing, Ready, and Completed.
