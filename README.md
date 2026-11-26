# ParkRelay

An attendant dashboard for a garage with 10 car spaces and 4 motorcycle spaces. Enter a plate and vehicle type to issue a ticket. Enter the ticket ID at checkout to free its space and calculate the fee. The demo rounds up to the next hour and bills at least one hour, at ¥300 for cars and ¥150 for motorcycles.

```sh
node server.js
```

Use Node.js 18 or later and open http://127.0.0.1:8032. Data persists in garage.json, or at the path configured with PARKRELAY_DATA. Run one server process per data file. The server binds to localhost by default. Use sample plates.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /api/garage | View spots, rates, active tickets, and recent exits |
| POST | /api/entry | Send plate and type to assign a spot |
| POST | /api/exit | Send ticket to close it and retrieve the receipt |
