import streamlit as st
import sqlite3
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import random
import os

# ──────────────────────────────────────────────────────────────────────────────
# Database setup
# ──────────────────────────────────────────────────────────────────────────────
DB_PATH = "ev_charging.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    c = conn.cursor()

    c.executescript("""
        CREATE TABLE IF NOT EXISTS stations (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            location    TEXT NOT NULL,
            connector   TEXT NOT NULL,
            power_kw    REAL NOT NULL,
            status      TEXT NOT NULL DEFAULT 'Available',
            created_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            email       TEXT UNIQUE NOT NULL,
            phone       TEXT,
            plan        TEXT DEFAULT 'Pay-as-you-go',
            balance     REAL DEFAULT 0.0,
            created_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tariffs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            price_kwh   REAL NOT NULL,
            idle_fee    REAL DEFAULT 0.0,
            valid_from  TEXT NOT NULL,
            valid_to    TEXT,
            active      INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            station_id      INTEGER NOT NULL,
            user_id         INTEGER NOT NULL,
            tariff_id       INTEGER,
            start_time      TEXT NOT NULL,
            end_time        TEXT,
            energy_kwh      REAL DEFAULT 0.0,
            cost            REAL DEFAULT 0.0,
            status          TEXT DEFAULT 'Active',
            FOREIGN KEY (station_id) REFERENCES stations(id),
            FOREIGN KEY (user_id)    REFERENCES users(id),
            FOREIGN KEY (tariff_id)  REFERENCES tariffs(id)
        );
    """)
    conn.commit()
    _seed(conn)
    conn.close()


def _seed(conn):
    c = conn.cursor()
    if c.execute("SELECT COUNT(*) FROM stations").fetchone()[0] > 0:
        return  # already seeded

    stations = [
        ("Station Alpha", "Downtown Plaza, Level B1", "CCS", 150, "Available"),
        ("Station Beta",  "Airport Terminal 2",       "CHAdeMO", 50, "Available"),
        ("Station Gamma", "Mall Parking Lot C",       "Type 2",  22, "Occupied"),
        ("Station Delta", "Highway Rest Stop 14",     "CCS",    350, "Available"),
        ("Station Epsilon","City Hall Parking",       "Type 2",  11, "Faulted"),
        ("Station Zeta",  "Hotel Grand Lobby",        "CCS",    150, "Available"),
    ]
    c.executemany(
        "INSERT INTO stations (name, location, connector, power_kw, status) VALUES (?,?,?,?,?)",
        stations,
    )

    users = [
        ("Alice Johnson", "alice@example.com", "+1-555-0101", "Premium", 120.50),
        ("Bob Smith",     "bob@example.com",   "+1-555-0102", "Pay-as-you-go", 45.00),
        ("Carol White",   "carol@example.com", "+1-555-0103", "Fleet",  500.00),
        ("David Lee",     "david@example.com", "+1-555-0104", "Pay-as-you-go", 10.75),
        ("Eva Brown",     "eva@example.com",   "+1-555-0105", "Premium", 200.00),
    ]
    c.executemany(
        "INSERT INTO users (name, email, phone, plan, balance) VALUES (?,?,?,?,?)",
        users,
    )

    tariffs = [
        ("Standard",  0.28, 0.05, "2024-01-01", None, 1),
        ("Premium",   0.22, 0.02, "2024-01-01", None, 1),
        ("Off-Peak",  0.18, 0.00, "2024-01-01", None, 1),
        ("Fleet",     0.20, 0.01, "2024-01-01", None, 1),
    ]
    c.executemany(
        "INSERT INTO tariffs (name, price_kwh, idle_fee, valid_from, valid_to, active) VALUES (?,?,?,?,?,?)",
        tariffs,
    )

    # Historic sessions
    now = datetime.now()
    for i in range(40):
        start = now - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
        duration = random.uniform(0.5, 3.0)
        end = start + timedelta(hours=duration)
        energy = round(random.uniform(5, 60), 2)
        price = round(energy * random.uniform(0.18, 0.28), 2)
        station_id = random.randint(1, 6)
        user_id = random.randint(1, 5)
        tariff_id = random.randint(1, 4)
        c.execute(
            "INSERT INTO sessions (station_id, user_id, tariff_id, start_time, end_time, energy_kwh, cost, status) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (station_id, user_id, tariff_id,
             start.strftime("%Y-%m-%d %H:%M:%S"),
             end.strftime("%Y-%m-%d %H:%M:%S"),
             energy, price, "Completed"),
        )

    # One active session
    c.execute(
        "INSERT INTO sessions (station_id, user_id, tariff_id, start_time, status) VALUES (3, 1, 1, ?, 'Active')",
        (now.strftime("%Y-%m-%d %H:%M:%S"),),
    )
    conn.commit()


# ──────────────────────────────────────────────────────────────────────────────
# Helper queries
# ──────────────────────────────────────────────────────────────────────────────
def df(query, params=()):
    conn = get_conn()
    result = pd.read_sql_query(query, conn, params=params)
    conn.close()
    return result


def run(query, params=()):
    conn = get_conn()
    conn.execute(query, params)
    conn.commit()
    conn.close()


def scalar(query, params=()):
    conn = get_conn()
    val = conn.execute(query, params).fetchone()[0]
    conn.close()
    return val


# ──────────────────────────────────────────────────────────────────────────────
# Page functions
# ──────────────────────────────────────────────────────────────────────────────

def page_dashboard():
    st.title("Dashboard")

    # KPI row
    total_stations  = scalar("SELECT COUNT(*) FROM stations")
    available       = scalar("SELECT COUNT(*) FROM stations WHERE status='Available'")
    occupied        = scalar("SELECT COUNT(*) FROM stations WHERE status='Occupied'")
    faulted         = scalar("SELECT COUNT(*) FROM stations WHERE status='Faulted'")
    active_sessions = scalar("SELECT COUNT(*) FROM sessions WHERE status='Active'")
    total_revenue   = scalar("SELECT COALESCE(SUM(cost),0) FROM sessions WHERE status='Completed'") or 0
    total_energy    = scalar("SELECT COALESCE(SUM(energy_kwh),0) FROM sessions WHERE status='Completed'") or 0
    total_users     = scalar("SELECT COUNT(*) FROM users")

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total Stations",   total_stations)
    col2.metric("Active Sessions",  active_sessions)
    col3.metric("Total Revenue",    f"${total_revenue:,.2f}")
    col4.metric("Energy Delivered", f"{total_energy:,.1f} kWh")

    st.divider()

    # Station status donut
    col_a, col_b = st.columns(2)
    with col_a:
        status_data = df("SELECT status, COUNT(*) as count FROM stations GROUP BY status")
        fig = px.pie(status_data, names="status", values="count",
                     title="Station Status", hole=0.45,
                     color="status",
                     color_discrete_map={"Available": "#22c55e",
                                         "Occupied":  "#f59e0b",
                                         "Faulted":   "#ef4444",
                                         "Offline":   "#6b7280"})
        fig.update_layout(margin=dict(t=40, b=0, l=0, r=0))
        st.plotly_chart(fig, use_container_width=True)

    with col_b:
        energy_df = df("""
            SELECT DATE(start_time) as day, SUM(energy_kwh) as energy, SUM(cost) as revenue
            FROM sessions WHERE status='Completed'
            GROUP BY day ORDER BY day DESC LIMIT 14
        """)
        energy_df = energy_df.sort_values("day")
        fig2 = px.bar(energy_df, x="day", y="energy", title="Daily Energy Delivered (kWh)",
                      color_discrete_sequence=["#3b82f6"])
        fig2.update_layout(xaxis_title="", yaxis_title="kWh", margin=dict(t=40, b=0))
        st.plotly_chart(fig2, use_container_width=True)

    # Revenue trend
    rev_df = df("""
        SELECT DATE(start_time) as day, SUM(cost) as revenue
        FROM sessions WHERE status='Completed'
        GROUP BY day ORDER BY day ASC
    """)
    fig3 = px.area(rev_df, x="day", y="revenue", title="Revenue Trend ($)",
                   color_discrete_sequence=["#8b5cf6"])
    fig3.update_layout(xaxis_title="", yaxis_title="Revenue ($)")
    st.plotly_chart(fig3, use_container_width=True)

    # Recent sessions table
    st.subheader("Recent Sessions")
    recent = df("""
        SELECT s.id, st.name as station, u.name as user,
               s.start_time, s.end_time, s.energy_kwh, s.cost, s.status
        FROM sessions s
        JOIN stations st ON st.id = s.station_id
        JOIN users u ON u.id = s.user_id
        ORDER BY s.id DESC LIMIT 8
    """)
    st.dataframe(recent, use_container_width=True, hide_index=True)


def page_stations():
    st.title("Charging Stations")

    tab1, tab2 = st.tabs(["All Stations", "Add Station"])

    with tab1:
        stations = df("SELECT * FROM stations ORDER BY id DESC")

        # Status filter
        status_filter = st.selectbox("Filter by Status", ["All", "Available", "Occupied", "Faulted", "Offline"])
        if status_filter != "All":
            stations = stations[stations["status"] == status_filter]

        for _, row in stations.iterrows():
            with st.expander(f"#{row['id']}  {row['name']}  —  {row['location']}"):
                c1, c2, c3, c4 = st.columns(4)
                c1.metric("Connector", row["connector"])
                c2.metric("Power", f"{row['power_kw']} kW")
                status_color = {"Available": "green", "Occupied": "orange",
                                "Faulted": "red", "Offline": "grey"}.get(row["status"], "blue")
                c3.metric("Status", row["status"])
                c4.metric("Added", row["created_at"][:10])

                with st.form(f"edit_station_{row['id']}"):
                    st.markdown("**Edit Station**")
                    ec1, ec2 = st.columns(2)
                    new_name   = ec1.text_input("Name",      value=row["name"])
                    new_loc    = ec2.text_input("Location",  value=row["location"])
                    ec3, ec4, ec5 = st.columns(3)
                    new_conn   = ec3.selectbox("Connector", ["CCS","CHAdeMO","Type 2","Tesla"],
                                               index=["CCS","CHAdeMO","Type 2","Tesla"].index(row["connector"])
                                                     if row["connector"] in ["CCS","CHAdeMO","Type 2","Tesla"] else 0)
                    new_power  = ec4.number_input("Power (kW)", value=float(row["power_kw"]), min_value=1.0)
                    new_status = ec5.selectbox("Status", ["Available","Occupied","Faulted","Offline"],
                                               index=["Available","Occupied","Faulted","Offline"].index(row["status"])
                                                     if row["status"] in ["Available","Occupied","Faulted","Offline"] else 0)
                    col_save, col_del = st.columns(2)
                    if col_save.form_submit_button("Save Changes"):
                        run("UPDATE stations SET name=?,location=?,connector=?,power_kw=?,status=? WHERE id=?",
                            (new_name, new_loc, new_conn, new_power, new_status, row["id"]))
                        st.success("Station updated!")
                        st.rerun()
                    if col_del.form_submit_button("Delete Station", type="secondary"):
                        run("DELETE FROM stations WHERE id=?", (row["id"],))
                        st.warning("Station deleted.")
                        st.rerun()

    with tab2:
        with st.form("add_station"):
            st.markdown("### New Charging Station")
            a1, a2 = st.columns(2)
            sname    = a1.text_input("Station Name", placeholder="Station Alpha")
            sloc     = a2.text_input("Location",     placeholder="123 Main St, Parking Level B1")
            a3, a4, a5 = st.columns(3)
            sconn    = a3.selectbox("Connector Type", ["CCS","CHAdeMO","Type 2","Tesla"])
            spower   = a4.number_input("Power (kW)", min_value=1.0, value=50.0)
            sstatus  = a5.selectbox("Initial Status", ["Available","Offline"])
            if st.form_submit_button("Add Station", type="primary"):
                if sname and sloc:
                    run("INSERT INTO stations (name, location, connector, power_kw, status) VALUES (?,?,?,?,?)",
                        (sname, sloc, sconn, spower, sstatus))
                    st.success(f"Station '{sname}' added!")
                    st.rerun()
                else:
                    st.error("Name and location are required.")


def page_sessions():
    st.title("Charging Sessions")

    tab1, tab2, tab3 = st.tabs(["Active Sessions", "All Sessions", "New Session"])

    with tab1:
        active = df("""
            SELECT s.id, st.name as station, u.name as user,
                   s.start_time, s.energy_kwh, s.status
            FROM sessions s
            JOIN stations st ON st.id = s.station_id
            JOIN users u ON u.id = s.user_id
            WHERE s.status = 'Active'
            ORDER BY s.id DESC
        """)
        if active.empty:
            st.info("No active sessions at the moment.")
        else:
            for _, row in active.iterrows():
                with st.expander(f"Session #{row['id']}  —  {row['station']}  ({row['user']})"):
                    sc1, sc2, sc3 = st.columns(3)
                    sc1.metric("Started", row["start_time"])
                    sc2.metric("Energy so far", f"{row['energy_kwh']} kWh")
                    sc3.metric("Status", row["status"])
                    with st.form(f"stop_{row['id']}"):
                        energy_final = st.number_input("Final Energy (kWh)", min_value=0.0, value=float(row["energy_kwh"]) or 10.0)
                        tariff_price = scalar("SELECT price_kwh FROM tariffs WHERE active=1 LIMIT 1") or 0.28
                        cost_final   = round(energy_final * tariff_price, 2)
                        st.info(f"Estimated cost: **${cost_final}**  (@ ${tariff_price}/kWh)")
                        if st.form_submit_button("Stop Session & Finalize", type="primary"):
                            run("""UPDATE sessions SET end_time=?, energy_kwh=?, cost=?, status='Completed'
                                   WHERE id=?""",
                                (datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                 energy_final, cost_final, row["id"]))
                            run("UPDATE stations SET status='Available' WHERE id=(SELECT station_id FROM sessions WHERE id=?)",
                                (row["id"],))
                            st.success("Session completed!")
                            st.rerun()

    with tab2:
        sessions = df("""
            SELECT s.id, st.name as station, u.name as user,
                   t.name as tariff, s.start_time, s.end_time,
                   s.energy_kwh, s.cost, s.status
            FROM sessions s
            JOIN stations st ON st.id = s.station_id
            JOIN users u ON u.id = s.user_id
            LEFT JOIN tariffs t ON t.id = s.tariff_id
            ORDER BY s.id DESC
        """)
        status_f = st.selectbox("Filter", ["All","Active","Completed"], key="sess_filter")
        if status_f != "All":
            sessions = sessions[sessions["status"] == status_f]
        st.dataframe(sessions, use_container_width=True, hide_index=True)
        total = sessions["cost"].sum() if not sessions.empty else 0
        st.caption(f"Total revenue shown: **${total:,.2f}**  |  Sessions: **{len(sessions)}**")

    with tab3:
        stations_avail = df("SELECT id, name FROM stations WHERE status='Available'")
        users_list     = df("SELECT id, name FROM users")
        tariffs_list   = df("SELECT id, name, price_kwh FROM tariffs WHERE active=1")

        with st.form("new_session"):
            st.markdown("### Start New Charging Session")
            ns1, ns2 = st.columns(2)
            station_opts = {row["name"]: row["id"] for _, row in stations_avail.iterrows()}
            user_opts    = {row["name"]: row["id"] for _, row in users_list.iterrows()}
            tariff_opts  = {f"{row['name']} (${row['price_kwh']}/kWh)": row["id"]
                            for _, row in tariffs_list.iterrows()}

            sel_station = ns1.selectbox("Station", list(station_opts.keys()) or ["No available stations"])
            sel_user    = ns2.selectbox("User",    list(user_opts.keys()))
            sel_tariff  = st.selectbox("Tariff",   list(tariff_opts.keys()))

            if st.form_submit_button("Start Session", type="primary"):
                if station_opts:
                    sid = station_opts[sel_station]
                    uid = user_opts[sel_user]
                    tid = tariff_opts[sel_tariff]
                    run("INSERT INTO sessions (station_id, user_id, tariff_id, start_time, status) VALUES (?,?,?,?,?)",
                        (sid, uid, tid, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "Active"))
                    run("UPDATE stations SET status='Occupied' WHERE id=?", (sid,))
                    st.success("Session started!")
                    st.rerun()
                else:
                    st.error("No available stations.")


def page_users():
    st.title("Users & Customers")

    tab1, tab2 = st.tabs(["User List", "Add User"])

    with tab1:
        users = df("SELECT * FROM users ORDER BY id DESC")
        search = st.text_input("Search by name or email")
        if search:
            mask = (users["name"].str.contains(search, case=False) |
                    users["email"].str.contains(search, case=False))
            users = users[mask]

        for _, row in users.iterrows():
            sessions_count = scalar("SELECT COUNT(*) FROM sessions WHERE user_id=?", (row["id"],))
            spent          = scalar("SELECT COALESCE(SUM(cost),0) FROM sessions WHERE user_id=? AND status='Completed'",
                                    (row["id"],))
            with st.expander(f"#{row['id']}  {row['name']}  —  {row['email']}"):
                uc1, uc2, uc3, uc4 = st.columns(4)
                uc1.metric("Plan",          row["plan"])
                uc2.metric("Balance",       f"${row['balance']:.2f}")
                uc3.metric("Sessions",      sessions_count)
                uc4.metric("Total Spent",   f"${spent:.2f}")

                with st.form(f"edit_user_{row['id']}"):
                    eu1, eu2 = st.columns(2)
                    new_name  = eu1.text_input("Name",  value=row["name"])
                    new_email = eu2.text_input("Email", value=row["email"])
                    eu3, eu4  = st.columns(2)
                    new_phone = eu3.text_input("Phone", value=row["phone"] or "")
                    new_plan  = eu4.selectbox("Plan",
                                              ["Pay-as-you-go","Premium","Fleet"],
                                              index=["Pay-as-you-go","Premium","Fleet"].index(row["plan"])
                                                    if row["plan"] in ["Pay-as-you-go","Premium","Fleet"] else 0)
                    new_bal   = st.number_input("Balance ($)", value=float(row["balance"]), min_value=0.0)

                    col_s, col_d = st.columns(2)
                    if col_s.form_submit_button("Save Changes"):
                        run("UPDATE users SET name=?,email=?,phone=?,plan=?,balance=? WHERE id=?",
                            (new_name, new_email, new_phone, new_plan, new_bal, row["id"]))
                        st.success("User updated!")
                        st.rerun()
                    if col_d.form_submit_button("Delete User", type="secondary"):
                        run("DELETE FROM users WHERE id=?", (row["id"],))
                        st.warning("User deleted.")
                        st.rerun()

    with tab2:
        with st.form("add_user"):
            st.markdown("### New User")
            nu1, nu2 = st.columns(2)
            uname  = nu1.text_input("Full Name",  placeholder="Jane Doe")
            uemail = nu2.text_input("Email",      placeholder="jane@example.com")
            nu3, nu4, nu5 = st.columns(3)
            uphone = nu3.text_input("Phone",      placeholder="+1-555-0100")
            uplan  = nu4.selectbox("Plan",        ["Pay-as-you-go","Premium","Fleet"])
            ubal   = nu5.number_input("Initial Balance ($)", min_value=0.0, value=0.0)
            if st.form_submit_button("Add User", type="primary"):
                if uname and uemail:
                    try:
                        run("INSERT INTO users (name, email, phone, plan, balance) VALUES (?,?,?,?,?)",
                            (uname, uemail, uphone, uplan, ubal))
                        st.success(f"User '{uname}' added!")
                        st.rerun()
                    except Exception:
                        st.error("Email already exists.")
                else:
                    st.error("Name and email are required.")


def page_tariffs():
    st.title("Pricing & Tariffs")

    tab1, tab2 = st.tabs(["Current Tariffs", "Add Tariff"])

    with tab1:
        tariffs = df("SELECT * FROM tariffs ORDER BY id DESC")
        for _, row in tariffs.iterrows():
            active_label = "Active" if row["active"] else "Inactive"
            with st.expander(f"#{row['id']}  {row['name']}  —  ${row['price_kwh']}/kWh  [{active_label}]"):
                tc1, tc2, tc3, tc4 = st.columns(4)
                tc1.metric("Price/kWh",  f"${row['price_kwh']:.3f}")
                tc2.metric("Idle Fee",   f"${row['idle_fee']:.2f}/min")
                tc3.metric("Valid From", row["valid_from"])
                tc4.metric("Status",     active_label)

                with st.form(f"edit_tariff_{row['id']}"):
                    et1, et2, et3 = st.columns(3)
                    new_tname = et1.text_input("Name",        value=row["name"])
                    new_price = et2.number_input("Price/kWh ($)", value=float(row["price_kwh"]), min_value=0.0, format="%.4f")
                    new_idle  = et3.number_input("Idle Fee ($/min)", value=float(row["idle_fee"]), min_value=0.0, format="%.4f")
                    new_active = st.checkbox("Active", value=bool(row["active"]))
                    col_ts, col_td = st.columns(2)
                    if col_ts.form_submit_button("Save Changes"):
                        run("UPDATE tariffs SET name=?,price_kwh=?,idle_fee=?,active=? WHERE id=?",
                            (new_tname, new_price, new_idle, int(new_active), row["id"]))
                        st.success("Tariff updated!")
                        st.rerun()
                    if col_td.form_submit_button("Delete Tariff", type="secondary"):
                        run("DELETE FROM tariffs WHERE id=?", (row["id"],))
                        st.warning("Tariff deleted.")
                        st.rerun()

    with tab2:
        with st.form("add_tariff"):
            st.markdown("### New Tariff")
            at1, at2, at3 = st.columns(3)
            tname = at1.text_input("Tariff Name", placeholder="Night Rate")
            tprice = at2.number_input("Price/kWh ($)", min_value=0.0, value=0.25, format="%.4f")
            tidle  = at3.number_input("Idle Fee ($/min)", min_value=0.0, value=0.05, format="%.4f")
            at4, at5 = st.columns(2)
            tvfrom = at4.date_input("Valid From")
            tvto   = at5.date_input("Valid To (optional)", value=None)
            if st.form_submit_button("Add Tariff", type="primary"):
                if tname:
                    run("INSERT INTO tariffs (name, price_kwh, idle_fee, valid_from, valid_to, active) VALUES (?,?,?,?,?,1)",
                        (tname, tprice, tidle,
                         tvfrom.strftime("%Y-%m-%d"),
                         tvto.strftime("%Y-%m-%d") if tvto else None))
                    st.success(f"Tariff '{tname}' added!")
                    st.rerun()
                else:
                    st.error("Tariff name is required.")


def page_analytics():
    st.title("Analytics & Reports")

    period = st.selectbox("Period", ["Last 7 days", "Last 30 days", "All time"])
    days   = {"Last 7 days": 7, "Last 30 days": 30, "All time": 9999}[period]
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    # Top stations by revenue
    top_stations = df("""
        SELECT st.name, SUM(s.cost) as revenue, SUM(s.energy_kwh) as energy,
               COUNT(s.id) as sessions
        FROM sessions s
        JOIN stations st ON st.id = s.station_id
        WHERE s.status='Completed' AND DATE(s.start_time) >= ?
        GROUP BY st.name ORDER BY revenue DESC
    """, (cutoff,))

    col1, col2 = st.columns(2)
    with col1:
        fig = px.bar(top_stations, x="name", y="revenue",
                     title="Revenue by Station ($)",
                     color_discrete_sequence=["#6366f1"])
        fig.update_layout(xaxis_title="", yaxis_title="Revenue ($)")
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        fig2 = px.bar(top_stations, x="name", y="energy",
                      title="Energy Delivered by Station (kWh)",
                      color_discrete_sequence=["#22c55e"])
        fig2.update_layout(xaxis_title="", yaxis_title="kWh")
        st.plotly_chart(fig2, use_container_width=True)

    # Top users
    top_users = df("""
        SELECT u.name, SUM(s.cost) as spent, SUM(s.energy_kwh) as energy,
               COUNT(s.id) as sessions
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.status='Completed' AND DATE(s.start_time) >= ?
        GROUP BY u.name ORDER BY spent DESC
    """, (cutoff,))

    st.subheader("Top Users")
    st.dataframe(top_users, use_container_width=True, hide_index=True)

    # Connector type breakdown
    col3, col4 = st.columns(2)
    with col3:
        conn_data = df("""
            SELECT st.connector, COUNT(s.id) as sessions, SUM(s.cost) as revenue
            FROM sessions s
            JOIN stations st ON st.id = s.station_id
            WHERE s.status='Completed' AND DATE(s.start_time) >= ?
            GROUP BY st.connector
        """, (cutoff,))
        fig3 = px.pie(conn_data, names="connector", values="sessions",
                      title="Sessions by Connector Type", hole=0.4)
        st.plotly_chart(fig3, use_container_width=True)

    with col4:
        hourly = df("""
            SELECT CAST(strftime('%H', start_time) AS INTEGER) as hour,
                   COUNT(*) as sessions
            FROM sessions WHERE status='Completed' AND DATE(start_time) >= ?
            GROUP BY hour ORDER BY hour
        """, (cutoff,))
        fig4 = px.bar(hourly, x="hour", y="sessions",
                      title="Sessions by Hour of Day",
                      color_discrete_sequence=["#f59e0b"])
        fig4.update_layout(xaxis_title="Hour", yaxis_title="Sessions",
                           xaxis=dict(tickmode="linear", tick0=0, dtick=2))
        st.plotly_chart(fig4, use_container_width=True)

    # Summary table
    st.subheader("Station Summary")
    summary = df("""
        SELECT st.name, st.connector, st.power_kw, st.status,
               COUNT(s.id) as total_sessions,
               ROUND(SUM(s.energy_kwh),2) as total_energy_kwh,
               ROUND(SUM(s.cost),2) as total_revenue
        FROM stations st
        LEFT JOIN sessions s ON s.station_id = st.id AND s.status='Completed'
        GROUP BY st.id ORDER BY total_revenue DESC
    """)
    st.dataframe(summary, use_container_width=True, hide_index=True)


# ──────────────────────────────────────────────────────────────────────────────
# Main app
# ──────────────────────────────────────────────────────────────────────────────
def main():
    st.set_page_config(
        page_title="EV Charging CMS",
        page_icon="⚡",
        layout="wide",
        initial_sidebar_state="expanded",
    )

    init_db()

    # Sidebar navigation
    with st.sidebar:
        st.markdown("## ⚡ EV Charging CMS")
        st.divider()
        page = st.radio(
            "Navigation",
            ["Dashboard", "Stations", "Sessions", "Users", "Tariffs", "Analytics"],
            label_visibility="collapsed",
        )
        st.divider()
        st.caption(f"Last refreshed: {datetime.now().strftime('%H:%M:%S')}")
        if st.button("Refresh Data"):
            st.rerun()

    if page == "Dashboard":
        page_dashboard()
    elif page == "Stations":
        page_stations()
    elif page == "Sessions":
        page_sessions()
    elif page == "Users":
        page_users()
    elif page == "Tariffs":
        page_tariffs()
    elif page == "Analytics":
        page_analytics()


if __name__ == "__main__":
    main()
