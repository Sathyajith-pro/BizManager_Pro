import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import styles from "../styles/Home.module.css";

const EMPTY_ORDER_FORM = {
  name: "",
  address: "",
  phoneNumber: "",
  items: [{ itemName: "", quantity: 1, price: "" }],
  trackingNumber: "",
  courier: "",
  deliveryStatus: "Pending",
  cashReceived: "No",
  note: "",
};

const EMPTY_EXPENSE_FORM = {
  description: "",
  amount: "",
  category: "Stock",
  dateTime: new Date().toISOString().split("T")[0],
};

const EMPTY_USER_FORM = {
  username: "",
  password: "",
  name: "",
  role: "packer",
};

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateOnly(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric"
  });
}

function getOrderTotal(order) {
  if (order.totalPrice != null) return Number(order.totalPrice) || 0;
  if (order.price != null) return Number(order.price) || 0;
  if (order.items?.length) {
    return order.items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
  }
  return 0;
}

function getOrderStatus(order) {
  return order.deliveryStatus || order.status || "Pending";
}

export default function Home() {
  // Session States
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authenticating, setAuthenticating] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Data States
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  
  // Loading & Error States
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState("");
  
  // Forms & Modal Toggles
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  
  // Form Values
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER_FORM);
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE_FORM);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);

  // Search and Filters
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("All");
  const [orderCashFilter, setOrderCashFilter] = useState("All");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("All");

  // Packer Packing Checklist State
  const [packingChecks, setPackingChecks] = useState({});
  const [packerCourier, setPackerCourier] = useState({});
  const [packerTracking, setPackerTracking] = useState({});
  const [packerSubTab, setPackerSubTab] = useState("pending");
  const [viewMode, setViewMode] = useState("admin");
  const [printOrder, setPrintOrder] = useState(null);

  const effectiveView = currentUser?.role === "packer" ? "packer" : viewMode;

  // Initialize Session
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      const parsedUser = JSON.parse(savedUser);
      setCurrentUser(parsedUser);
      if (parsedUser.role === "packer") {
        setActiveTab("packing");
        setViewMode("packer");
      } else {
        setActiveTab("dashboard");
        const params = new URLSearchParams(window.location.search);
        const roleParam = params.get("role");
        if (roleParam === "packer") {
          setViewMode("packer");
          setActiveTab("packing");
        } else {
          setViewMode("admin");
        }
      }
    }
  }, []);

  // Sync ?role= query parameter for admin view switching
  useEffect(() => {
    if (typeof window === "undefined" || currentUser?.role !== "admin") return;
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get("role");
    if (roleParam === "packer") {
      setViewMode("packer");
      setActiveTab("packing");
    } else if (roleParam === "admin") {
      setViewMode("admin");
    }
  }, [currentUser]);

  useEffect(() => {
    const onAfterPrint = () => setPrintOrder(null);
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  const switchViewMode = (mode) => {
    if (currentUser?.role !== "admin") return;
    setViewMode(mode);
    if (mode === "packer") {
      setActiveTab("packing");
      setShowOrderForm(false);
      setShowExpenseForm(false);
      setShowUserForm(false);
    } else {
      setActiveTab("dashboard");
    }
    const url = new URL(window.location.href);
    if (mode === "packer") {
      url.searchParams.set("role", "packer");
    } else {
      url.searchParams.set("role", "admin");
    }
    window.history.replaceState({}, "", url.toString());
  };

  const handlePrintLabel = (order) => {
    setPrintOrder(order);
    requestAnimationFrame(() => {
      setTimeout(() => window.print(), 150);
    });
  };

  // Fetch Dashboard Stats (Admin Only)
  const fetchStats = useCallback(async (authToken) => {
    if (!authToken) return;
    setLoadingStats(true);
    try {
      const res = await fetch("/api/dashboard", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data);
      } else {
        setError(data.error || "Failed to load dashboard metrics.");
      }
    } catch {
      setError("Dashboard loading error.");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Fetch Orders
  const fetchOrders = useCallback(async (authToken) => {
    if (!authToken) return;
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/orders", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        setError("Failed to load orders.");
      }
    } catch {
      setError("Orders loading error.");
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  // Fetch Expenses (Admin Only)
  const fetchExpenses = useCallback(async (authToken) => {
    if (!authToken) return;
    setLoadingExpenses(true);
    try {
      const res = await fetch("/api/expenses", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setExpenses(data);
      } else {
        setError("Failed to load expenses.");
      }
    } catch {
      setError("Expenses loading error.");
    } finally {
      setLoadingExpenses(false);
    }
  }, []);

  // Fetch Users (Admin Only)
  const fetchUsers = useCallback(async (authToken) => {
    if (!authToken) return;
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        setError("Failed to load users.");
      }
    } catch {
      setError("Users loading error.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Synchronized Refreshes
  const refreshData = useCallback((authToken = token, userRole = currentUser?.role) => {
    if (!authToken) return;
    fetchOrders(authToken);
    if (userRole === "admin") {
      fetchStats(authToken);
      fetchExpenses(authToken);
      fetchUsers(authToken);
    }
  }, [token, currentUser, fetchOrders, fetchStats, fetchExpenses, fetchUsers]);

  useEffect(() => {
    if (token && currentUser) {
      refreshData(token, currentUser.role);
    }
  }, [token, currentUser, refreshData]);

  // Auth Handlers
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    if (!loginUsername || !loginPassword) {
      setLoginError("Please enter both credentials.");
      return;
    }
    setAuthenticating(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setToken(data.token);
        setCurrentUser(data.user);
        setLoginUsername("");
        setLoginPassword("");
        if (data.user.role === "packer") {
          setActiveTab("packing");
          setViewMode("packer");
        } else {
          setActiveTab("dashboard");
          setViewMode("admin");
        }
      } else {
        setLoginError(data.error || "Login failed.");
      }
    } catch {
      setLoginError("Network connection failed.");
    } finally {
      setAuthenticating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setCurrentUser(null);
    setOrders([]);
    setExpenses([]);
    setStats(null);
    setUsers([]);
  };

  // Order Form Item Handlers
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...orderForm.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setOrderForm((f) => ({ ...f, items: updatedItems }));
  };

  const addItemRow = () => {
    setOrderForm((f) => ({
      ...f,
      items: [...f.items, { itemName: "", quantity: 1, price: "" }]
    }));
  };

  const removeItemRow = (index) => {
    if (orderForm.items.length <= 1) return;
    const updatedItems = orderForm.items.filter((_, i) => i !== index);
    setOrderForm((f) => ({ ...f, items: updatedItems }));
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const { name, address, phoneNumber, items } = orderForm;
    if (!name || !address || !phoneNumber) {
      setFormError("Customer details are required.");
      return;
    }
    
    const invalidItem = items.some(item => !item.itemName || !item.price || Number(item.price) <= 0 || Number(item.quantity) <= 0);
    if (invalidItem) {
      setFormError("Please enter valid item name, quantity, and price.");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingOrderId ? `/api/orders/${editingOrderId}` : "/api/orders";
      const method = editingOrderId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(orderForm),
      });

      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error || "Failed to save order.");
        return;
      }

      setOrderForm(EMPTY_ORDER_FORM);
      setShowOrderForm(false);
      setEditingOrderId(null);
      refreshData();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const initiateOrderEdit = (order) => {
    setOrderForm({
      name: order.name,
      address: order.address,
      phoneNumber: order.phoneNumber,
      items: order.items && order.items.length > 0 ? order.items.map(i => ({
        itemName: i.itemName,
        quantity: i.quantity,
        price: i.price,
      })) : [{ itemName: "Earbuds / Product", quantity: order.pieces || 1, price: order.price || 0 }],
      trackingNumber: order.trackingNumber || "",
      courier: order.courier || "",
      deliveryStatus: order.deliveryStatus || order.status || "Pending",
      cashReceived: order.cashReceived || (order.status === "Approved" ? "Yes" : "No"),
      note: order.note || "",
    });
    setEditingOrderId(order._id);
    setShowOrderForm(true);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOrderDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this order?")) return;
    try {
      const res = await fetch(`/api/orders/${id}`, { 
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        refreshData();
      } else {
        setError("Failed to delete order.");
      }
    } catch {
      setError("Failed to delete order.");
    }
  };

  const handleQuickStatusChange = async (orderId, updates) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        refreshData();
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to update status.");
      }
    } catch {
      setError("Network error when updating status.");
    }
  };

  // Expense Handlers
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const { description, amount, category } = expenseForm;
    if (!description || !amount || Number(amount) <= 0 || !category) {
      setFormError("All fields must be valid.");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingExpenseId ? `/api/expenses/${editingExpenseId}` : "/api/expenses";
      const method = editingExpenseId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(expenseForm),
      });

      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error || "Failed to save expense.");
        return;
      }

      setExpenseForm(EMPTY_EXPENSE_FORM);
      setShowExpenseForm(false);
      setEditingExpenseId(null);
      refreshData();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const initiateExpenseEdit = (expense) => {
    setExpenseForm({
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      dateTime: expense.dateTime ? new Date(expense.dateTime).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    });
    setEditingExpenseId(expense._id);
    setShowExpenseForm(true);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleExpenseDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { 
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        refreshData();
      } else {
        setError("Failed to delete expense.");
      }
    } catch {
      setError("Failed to delete expense.");
    }
  };

  // User CRUD Form Submission
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const { username, password, name, role } = userForm;
    if (!username || !name || !role || (!editingUserId && !password)) {
      setFormError("Please fill out all fields.");
      return;
    }

    setSubmitting(true);
    try {
      const url = editingUserId ? `/api/users/${editingUserId}` : "/api/users";
      const method = editingUserId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(userForm),
      });

      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error || "Failed to save user.");
        return;
      }

      setUserForm(EMPTY_USER_FORM);
      setShowUserForm(false);
      setEditingUserId(null);
      refreshData();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const initiateUserEdit = (userObj) => {
    setUserForm({
      username: userObj.username,
      password: "", 
      name: userObj.name,
      role: userObj.role,
    });
    setEditingUserId(userObj._id);
    setShowUserForm(true);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleUserDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { 
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        refreshData();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to delete user.");
      }
    } catch {
      setError("Failed to delete user.");
    }
  };

  // Packer Confirmation Workflow
  const handleTogglePackCheck = (orderId, idx) => {
    setPackingChecks((prev) => {
      const orderChecks = prev[orderId] || {};
      const newChecks = { ...orderChecks, [idx]: !orderChecks[idx] };
      return { ...prev, [orderId]: newChecks };
    });
  };

  const handlePackerConfirmPacked = async (order) => {
    const courierVal = packerCourier[order._id] || "";
    const trackingVal = packerTracking[order._id] || "";

    if (!courierVal) {
      alert("Please enter the courier service name before confirming (E.g. Koombiyo).");
      return;
    }

    try {
      const res = await fetch(`/api/orders/${order._id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          deliveryStatus: "Delivered",
          courier: courierVal,
          trackingNumber: trackingVal,
        }),
      });

      if (res.ok) {
        alert(`Order ${order.orderId || ""} successfully packed and dispatched!`);
        refreshData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to confirm packed.");
      }
    } catch {
      alert("Network error. Please try again.");
    }
  };

  // Filter Logics
  const filteredOrders = orders.filter((order) => {
    const searchLower = orderSearch.toLowerCase();
    const orderIdStr = order.orderId ? order.orderId.toLowerCase() : "";
    const nameStr = order.name ? order.name.toLowerCase() : "";
    const phoneStr = order.phoneNumber ? order.phoneNumber.toLowerCase() : "";
    const trackingStr = order.trackingNumber ? order.trackingNumber.toLowerCase() : "";
    const courierStr = order.courier ? order.courier.toLowerCase() : "";
    
    const itemsMatch = order.items && order.items.some(
      (item) => item.itemName && item.itemName.toLowerCase().includes(searchLower)
    );

    const matchesSearch = 
      orderIdStr.includes(searchLower) ||
      nameStr.includes(searchLower) ||
      phoneStr.includes(searchLower) ||
      trackingStr.includes(searchLower) ||
      courierStr.includes(searchLower) ||
      itemsMatch;

    const currentStatus = order.deliveryStatus || order.status || "Pending";
    const matchesStatus = orderStatusFilter === "All" || currentStatus === orderStatusFilter;

    const currentCash = order.cashReceived || (order.status === "Approved" ? "Yes" : "No");
    const matchesCash = orderCashFilter === "All" || currentCash === orderCashFilter;

    return matchesSearch && matchesStatus && matchesCash;
  });

  const filteredExpenses = expenses.filter((expense) => {
    return expenseCategoryFilter === "All" || expense.category === expenseCategoryFilter;
  });

  const packerPendingOrders = orders.filter((o) => getOrderStatus(o) === "Pending");
  const packerCompletedOrders = orders.filter((o) => getOrderStatus(o) !== "Pending");

  if (!token) {
    return (
      <div className={styles.loginPage}>
        <div className={styles.loginCard}>
          <h1 className={styles.loginTitle}>BizManager Pro</h1>
          <p className={styles.loginSubtitle}>Sign in to manage online store</p>
          {loginError && <div className={styles.formError}>{loginError}</div>}
          <form onSubmit={handleLoginSubmit} className={styles.form}>
            <div className={styles.field} style={{ textAlign: "left" }}>
              <label className={styles.label}>Username</label>
              <input
                className={styles.input}
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>
            <div className={styles.field} style={{ textAlign: "left" }}>
              <label className={styles.label}>Password</label>
              <input
                className={styles.input}
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            <button type="submit" className={styles.submitBtn} style={{ marginTop: "12px" }} disabled={authenticating}>
              {authenticating ? "Authenticating…" : "Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── CSS PRINT STYLES - COMPACT VERTICAL LAYOUT ── */}
      <style jsx global>{`
        @media print {
          /* Hide everything outside the portal */
          body * {
            display: none !important;
          }
          #print-label-container, 
          #print-label-container * {
            display: block !important;
            box-sizing: border-box !important;
          }
          /* Custom 80mm Landscape optimized dimensions */
          #print-label-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 145mm !important;
            height: 52mm !important;
            max-height: 52mm !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Outer rounded card setup */
          .thermalLabelCard {
            width: 100% !important;
            height: 100% !important;
            border: 2px solid #000000 !important;
            border-radius: 8px !important;
            padding: 6px 12px !important;
            font-family: Arial, sans-serif !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          /* High-contrast top header bar for COD */
          .thermalLabelCod {
            display: flex !important;
            flex-direction: row !important;
            align-items: stretch !important;
            border: 2px solid #000000 !important;
            border-radius: 4px !important;
            width: 60% !important;
            margin: 0 auto 5px auto !important;
            overflow: hidden !important;
          }
          .thermalLabelCodLeft {
            background-color: #000000 !important;
            color: #ffffff !important;
            font-weight: bold !important;
            font-size: 11pt !important;
            padding: 2px 8px !important;
            text-align: center !important;
            display: flex !important;
            align-items: center !important;
          }
          .thermalLabelCodRight {
            color: #000000 !important;
            font-weight: bold !important;
            font-size: 11pt !important;
            padding: 2px 8px !important;
            flex-grow: 1 !important;
            text-align: center !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          /* STRICT VERTICAL FLOW: FROM first, then TO directly below it */
          .thermalLabelContentStack {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            gap: 4px !important;
          }
          .thermalLabelRowBlock {
            display: block !important;
            width: 100% !important;
            padding: 2px 0 !important;
          }
          .thermalLabelFromBlock {
            border-bottom: 1px dashed #000000 !important;
            padding-bottom: 3px !important;
          }
          /* Inline design to save extreme space and length */
          .thermalLabelLineInline {
            display: inline !important;
            font-size: 10.5pt !important;
            line-height: 1.2 !important;
          }
          .thermalLabelTag {
            font-weight: bold !important;
            font-size: 11pt !important;
            text-transform: uppercase !important;
            display: inline !important;
            margin-right: 4px !important;
          }
          .thermalLabelPhoneInline {
            font-weight: bold !important;
            font-size: 11pt !important;
            display: inline !important;
            margin-left: 6px !important;
          }
        }
      `}</style>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div>
            <h1 className={styles.title}>BizManager Pro</h1>
            <p className={styles.subtitle}>
              Hello, <strong>{currentUser?.name}</strong> ({currentUser?.role})
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {currentUser?.role === "admin" && (
              <div className={styles.roleSwitcher} title="Switch dashboard view">
                <button
                  type="button"
                  className={`${styles.roleSwitchBtn} ${effectiveView === "admin" ? styles.roleSwitchActive : ""}`}
                  onClick={() => switchViewMode("admin")}
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  className={`${styles.roleSwitchBtn} ${effectiveView === "packer" ? styles.roleSwitchActive : ""}`}
                  onClick={() => switchViewMode("packer")}
                >
                  📦 Packer
                </button>
              </div>
            )}
            {effectiveView === "admin" && currentUser?.role === "admin" && (
              <>
                <button
                  className={styles.addBtn}
                  onClick={() => {
                    setShowOrderForm((v) => !v);
                    setShowExpenseForm(false);
                    setShowUserForm(false);
                    setFormError("");
                    setEditingOrderId(null);
                    setOrderForm(EMPTY_ORDER_FORM);
                  }}
                >
                  {showOrderForm ? "✕ Close Form" : "+ New Order"}
                </button>
                <button
                  className={styles.addBtn}
                  style={{ background: "linear-gradient(135deg, var(--accent), var(--error))" }}
                  onClick={() => {
                    setShowExpenseForm((v) => !v);
                    setShowOrderForm(false);
                    setShowUserForm(false);
                    setFormError("");
                    setEditingExpenseId(null);
                    setExpenseForm(EMPTY_EXPENSE_FORM);
                  }}
                >
                  {showExpenseForm ? "✕ Close Form" : "+ Log Expense"}
                </button>
              </>
            )}
            <button className={styles.logoutBtn} onClick={handleLogout}>
              Logout 🔒
            </button>
          </div>
        </div>
      </header>

      {/* ── Tabs Container ── */}
      {effectiveView === "admin" && (
        <div className={styles.tabsContainer}>
          <button className={`${styles.tab} ${activeTab === "dashboard" ? styles.activeTab : ""}`} onClick={() => setActiveTab("dashboard")}>📈 Analytics</button>
          <button className={`${styles.tab} ${activeTab === "orders" ? styles.activeTab : ""}`} onClick={() => setActiveTab("orders")}>📦 Orders ({orders.length})</button>
          <button className={`${styles.tab} ${activeTab === "expenses" ? styles.activeTab : ""}`} onClick={() => setActiveTab("expenses")}>💸 Expenses ({expenses.length})</button>
          <button className={`${styles.tab} ${activeTab === "users" ? styles.activeTab : ""}`} onClick={() => setActiveTab("users")}>👥 User Accounts ({users.length})</button>
        </div>
      )}

      <main className={styles.main}>
        {error && <div className={styles.formError} style={{ margin: 0 }}>{error}</div>}

        {/* ── FORM: Order Form ── */}
        {showOrderForm && effectiveView === "admin" && currentUser?.role === "admin" && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>{editingOrderId ? "Edit Order details" : "Add New Order"}</h2>
            {formError && <div className={styles.formError}>{formError}</div>}
            <form onSubmit={handleOrderSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Customer Name</label>
                  <input className={styles.input} value={orderForm.name} onChange={(e) => setOrderForm({ ...orderForm, name: e.target.value })} placeholder="E.g. Deshan" required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Phone Number</label>
                  <input className={styles.input} value={orderForm.phoneNumber} onChange={(e) => setOrderForm({ ...orderForm, phoneNumber: e.target.value })} placeholder="E.g. 0771234567" required />
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label className={styles.label}>Delivery Address</label>
                  <input className={styles.input} value={orderForm.address} onChange={(e) => setOrderForm({ ...orderForm, address: e.target.value })} placeholder="No. 12, Galle Road" required />
                </div>
              </div>

              <div className={styles.itemsSection}>
                <div className={styles.itemsHeader}>
                  <label className={styles.label}>Order Items List</label>
                  <button type="button" onClick={addItemRow} className={styles.addItemBtn}>+ Add Item Row</button>
                </div>
                {orderForm.items.map((item, index) => (
                  <div key={index} className={styles.itemsGrid}>
                    <div className={styles.field}>
                      <label className={styles.label}>Product Item Name</label>
                      <input className={styles.input} value={item.itemName} onChange={(e) => handleItemChange(index, "itemName", e.target.value)} placeholder="E.g. Earbuds Pro" required />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Qty</label>
                      <input className={styles.input} type="number" min="1" value={item.quantity} onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))} required />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Unit Price (Rs.)</label>
                      <input className={styles.input} type="number" step="0.01" placeholder="0.00" value={item.price} onChange={(e) => handleItemChange(index, "price", e.target.value)} required />
                    </div>
                    {orderForm.items.length > 1 && (
                      <button type="button" onClick={() => removeItemRow(index)} className={styles.removeItemBtn} title="Remove product">✕</button>
                    )}
                  </div>
                ))}
              </div>

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Courier Service</label>
                  <input className={styles.input} value={orderForm.courier} onChange={(e) => setOrderForm({ ...orderForm, courier: e.target.value })} placeholder="E.g. Koombiyo" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Tracking Number</label>
                  <input className={styles.input} value={orderForm.trackingNumber} onChange={(e) => setOrderForm({ ...orderForm, trackingNumber: e.target.value })} placeholder="E.g. KB10098234" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Delivery Status</label>
                  <select className={styles.select} value={orderForm.deliveryStatus} onChange={(e) => setOrderForm({ ...orderForm, deliveryStatus: e.target.value })}>
                    <option value="Pending">⌛ Pending</option>
                    <option value="Delivered">🚚 Delivered</option>
                    <option value="Return">🔄 Returned</option>
                    <option value="Completed">✅ Completed</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Cash Received?</label>
                  <select className={styles.select} value={orderForm.cashReceived} onChange={(e) => setOrderForm({ ...orderForm, cashReceived: e.target.value })}>
                    <option value="No">❌ No</option>
                    <option value="Yes">💵 Yes</option>
                  </select>
                </div>
                <div className={`${styles.field} ${styles.fieldWide}`}>
                  <label className={styles.label}>Note</label>
                  <input className={styles.input} value={orderForm.note} onChange={(e) => setOrderForm({ ...orderForm, note: e.target.value })} placeholder="Additional details" />
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => { setShowOrderForm(false); setFormError(""); setOrderForm(EMPTY_ORDER_FORM); setEditingOrderId(null); }}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>{submitting ? "Saving…" : editingOrderId ? "Update Order" : "Add Order"}</button>
              </div>
            </form>
          </div>
        )}

        {/* ── FORM: Expense Form ── */}
        {showExpenseForm && effectiveView === "admin" && currentUser?.role === "admin" && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>{editingExpenseId ? "Edit Expense details" : "Log Business Expense"}</h2>
            {formError && <div className={styles.formError}>{formError}</div>}
            <form onSubmit={handleExpenseSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Description / Purpose</label>
                  <input className={styles.input} value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="E.g. Stock" required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Amount (Rs.)</label>
                  <input className={styles.input} type="number" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Expense Category</label>
                  <select className={styles.select} value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                    <option value="Stock">📦 Stock Buying</option>
                    <option value="Courier">🚚 Courier Charges</option>
                    <option value="Marketing">📢 Marketing / Ads</option>
                    <option value="Other">💼 Other Expenses</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Expense Date</label>
                  <input className={styles.input} type="date" value={expenseForm.dateTime} onChange={(e) => setExpenseForm({ ...expenseForm, dateTime: e.target.value })} required />
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => { setShowExpenseForm(false); setFormError(""); setExpenseForm(EMPTY_EXPENSE_FORM); setEditingExpenseId(null); }}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>{submitting ? "Saving…" : editingExpenseId ? "Update Expense" : "Save Expense"}</button>
              </div>
            </form>
          </div>
        )}

        {/* ── FORM: User Account Form ── */}
        {showUserForm && effectiveView === "admin" && currentUser?.role === "admin" && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>{editingUserId ? "Edit User details" : "Create User Account"}</h2>
            {formError && <div className={styles.formError}>{formError}</div>}
            <form onSubmit={handleUserSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Full Name</label>
                  <input className={styles.input} value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="E.g. Kamal" required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Username</label>
                  <input className={styles.input} value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} placeholder="E.g. kamal_packer" required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Password {editingUserId && "(leave blank to keep current)"}</label>
                  <input className={styles.input} type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Enter password" required={!editingUserId} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Role</label>
                  <select className={styles.select} value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                    <option value="packer">📦 Packer (Confirm packing only)</option>
                    <option value="admin">👑 Admin (Full dashboard access)</option>
                  </select>
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => { setShowUserForm(false); setFormError(""); setUserForm(EMPTY_USER_FORM); setEditingUserId(null); }}>Cancel</button>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>{submitting ? "Saving User…" : editingUserId ? "Update User" : "Create User"}</button>
              </div>
            </form>
          </div>
        )}

        {/* ── TAB 1: ANALYTICS DASHBOARD ── */}
        {activeTab === "dashboard" && effectiveView === "admin" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {loadingStats ? (
              <div className={styles.spinner} />
            ) : stats ? (
              <>
                <div className={styles.kpiGrid}>
                  <div className={`${styles.kpiCard} ${styles.kpiCardProfit}`}>
                    <span className={styles.kpiLabel}>Net Profit</span>
                    <span className={`${styles.kpiValue} ${stats.netProfit >= 0 ? styles.positive : styles.negative}`}>
                      Rs. {stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={styles.kpiMeta}>Revenue minus logged expenses</span>
                  </div>
                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Total Revenue</span>
                    <span className={styles.kpiValue} style={{ color: "var(--approved)" }}>
                      Rs. {stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={styles.kpiMeta}>Delivered/Completed + Cashed orders</span>
                  </div>
                  <div className={`${styles.kpiCard} ${styles.kpiCardExpenses}`}>
                    <span className={styles.kpiLabel}>Total Expenses</span>
                    <span className={styles.kpiValue} style={{ color: "var(--error)" }}>
                      Rs. {stats.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={styles.kpiMeta}>Total spent across {stats.expenseCount} logs</span>
                  </div>
                  <div className={`${styles.kpiCard} ${styles.kpiCardOrders}`}>
                    <span className={styles.kpiLabel}>Total Gross Sales</span>
                    <span className={styles.kpiValue}>
                      Rs. {stats.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={styles.kpiMeta}>Sum of all {stats.orderCount} orders</span>
                  </div>
                </div>

                <div className={styles.dashboardContent}>
                  <div className={styles.chartCard}>
                    <h3 className={styles.sectionTitle}>🚚 Delivery status Tracking</h3>
                    <div className={styles.statusGrid}>
                      <div className={styles.statusMiniCard} style={{ borderLeft: "4px solid var(--pending)" }}>
                        <span className={styles.kpiLabel}>Pending</span>
                        <span className={styles.statusVal}>{stats.deliveryCounts.Pending}</span>
                      </div>
                      <div className={styles.statusMiniCard} style={{ borderLeft: "4px solid var(--primary)" }}>
                        <span className={styles.kpiLabel}>Delivered</span>
                        <span className={styles.statusVal}>{stats.deliveryCounts.Delivered}</span>
                      </div>
                      <div className={styles.statusMiniCard} style={{ borderLeft: "4px solid var(--error)" }}>
                        <span className={styles.kpiLabel}>Returned</span>
                        <span className={styles.statusVal}>{stats.deliveryCounts.Return}</span>
                      </div>
                      <div className={styles.statusMiniCard} style={{ borderLeft: "4px solid var(--approved)" }}>
                        <span className={styles.kpiLabel}>Completed</span>
                        <span className={styles.statusVal}>{stats.deliveryCounts.Completed}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.chartCard}>
                    <h3 className={styles.sectionTitle}>💵 Cash Summary</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
                        <span className={styles.kpiLabel} style={{ textTransform: "none" }}>Cash Received:</span>
                        <span style={{ fontWeight: "700", color: "var(--approved)" }}>Rs. {stats.cashValue.Yes.toLocaleString()} ({stats.cashCounts.Yes} orders)</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>
                        <span className={styles.kpiLabel} style={{ textTransform: "none" }}>Cash Pending:</span>
                        <span style={{ fontWeight: "700", color: "var(--pending)" }}>Rs. {stats.cashValue.No.toLocaleString()} ({stats.cashCounts.No} orders)</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span className={styles.kpiLabel} style={{ textTransform: "none" }}>Pending Shipments Value:</span>
                        <span style={{ fontWeight: "700", color: "var(--text-muted)" }}>Rs. {stats.pendingDeliveryVal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.emptyCell}>Loading Dashboard metrics...</div>
            )}
          </div>
        )}

        {/* ── TAB 2: ORDERS MANAGER ── */}
        {activeTab === "orders" && effectiveView === "admin" && (
          <>
            <div className={styles.filtersRow}>
              <input
                className={`${styles.input} ${styles.searchBar}`}
                placeholder="🔍 Search name, phone, tracking number, item, or order ID..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
              />
              <div className={styles.field} style={{ minWidth: "140px" }}>
                <select className={styles.select} value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Return">Returned</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className={styles.field} style={{ minWidth: "140px" }}>
                <select className={styles.select} value={orderCashFilter} onChange={(e) => setOrderCashFilter(e.target.value)}>
                  <option value="All">All Payment States</option>
                  <option value="Yes">Cash Received</option>
                  <option value="No">Cash Pending</option>
                </select>
              </div>
            </div>

            <div className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderInner}>
                  <span className={styles.sectionTitle} style={{ margin: 0 }}>Orders Log</span>
                  <span className={styles.count}>{filteredOrders.length} orders found</span>
                </div>
              </div>

              {/* Desktop Table */}
              <div className={`${styles.tableWrap} ${styles.desktopTableOnly}`}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Date</th>
                      <th>Customer Details</th>
                      <th>Product Items (Qty)</th>
                      <th>Total Value</th>
                      <th>Courier & Tracking</th>
                      <th>Delivery Status</th>
                      <th>Cash Recv?</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingOrders ? (
                      <tr><td colSpan={10} className={styles.emptyCell}><div className={styles.spinner} style={{ margin: 0 }} /> Loading...</td></tr>
                    ) : filteredOrders.length === 0 ? (
                      <tr><td colSpan={10} className={styles.emptyCell}>No orders matched your filters.</td></tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const statusClass = 
                          order.deliveryStatus === "Completed" ? styles.rowCompleted :
                          order.deliveryStatus === "Return" ? styles.rowReturn :
                          order.deliveryStatus === "Delivered" ? styles.rowDelivered :
                          styles.rowPending;

                        return (
                          <tr key={order._id} className={statusClass}>
                            <td className={styles.itemNum}>{order.orderId || "LEGACY"}</td>
                            <td className={styles.dateCell}>{formatDateTime(order.dateTime)}</td>
                            <td>
                              <div style={{ fontWeight: "600" }}>{order.name}</div>
                              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>📞 {order.phoneNumber}</div>
                              <div className={styles.address}>{order.address}</div>
                            </td>
                            <td>
                              <div className={styles.itemsList}>
                                {order.items && order.items.length > 0 ? (
                                  order.items.map((it, idx) => (
                                    <div key={idx} className={styles.itemLabel}>• {it.itemName} <span className={styles.itemQty}>(x{it.quantity})</span></div>
                                  ))
                                ) : (
                                  <div className={styles.itemLabel}>• Product <span className={styles.itemQty}>(x{order.pieces || 1})</span></div>
                                )}
                              </div>
                            </td>
                            <td style={{ fontWeight: "700", whiteSpace: "nowrap" }}>Rs. {(order.totalPrice || order.price || 0).toLocaleString()}</td>
                            <td>
                              {order.courier ? (
                                <div>
                                  <div style={{ fontWeight: "600" }}>{order.courier}</div>
                                  <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>{order.trackingNumber || "No tracking"}</div>
                                </div>
                              ) : <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Not dispatched</span>}
                            </td>
                            <td>
                              <div className={styles.quickStatusWrapper}>
                                <select className={styles.quickSelect} value={order.deliveryStatus || order.status || "Pending"} onChange={(e) => handleQuickStatusChange(order._id, { deliveryStatus: e.target.value })}>
                                  <option value="Pending">Pending</option>
                                  <option value="Delivered">Delivered</option>
                                  <option value="Return">Returned</option>
                                  <option value="Completed">Completed</option>
                                </select>
                              </div>
                            </td>
                            <td>
                              <span style={{ cursor: "pointer" }} onClick={() => handleQuickStatusChange(order._id, { cashReceived: (order.cashReceived === "Yes" ? "No" : "Yes") })} className={`${styles.badge} ${order.cashReceived === "Yes" ? styles.badgeYes : styles.badgeNo}`}>{order.cashReceived === "Yes" ? "Yes" : "No"}</span>
                            </td>
                            <td className={styles.noteCell}>{order.note}</td>
                            <td>
                              <div className={styles.actionButtons}>
                                <button className={styles.printBtn} onClick={() => handlePrintLabel(order)}>🖨 Print Label</button>
                                <button className={styles.editBtn} onClick={() => initiateOrderEdit(order)}>Edit</button>
                                <button className={styles.deleteBtn} onClick={() => handleOrderDelete(order._id)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className={styles.mobileCardsOnly}>
                {loadingOrders ? (
                  <div className={styles.spinner} />
                ) : filteredOrders.length === 0 ? (
                  <div className={styles.emptyCell}>No orders matched your filters.</div>
                ) : (
                  filteredOrders.map((order) => {
                    const statusClass = 
                      order.deliveryStatus === "Completed" ? styles.rowCompleted :
                      order.deliveryStatus === "Return" ? styles.rowReturn :
                      order.deliveryStatus === "Delivered" ? styles.rowDelivered :
                      styles.rowPending;

                    return (
                      <div key={order._id} className={`${styles.mobileOrderCard} ${statusClass}`}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className={styles.itemNum}>{order.orderId || "LEGACY"}</span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatDateTime(order.dateTime)}</span>
                        </div>
                        <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                          <div style={{ fontWeight: "700", fontSize: "15px" }}>{order.name}</div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>📞 {order.phoneNumber}</div>
                          <div style={{ fontSize: "13px", marginTop: "4px" }}>📍 {order.address}</div>
                        </div>
                        <div>
                          <div className={styles.label} style={{ fontSize: "9px" }}>Items:</div>
                          <div className={styles.itemsList} style={{ marginTop: "4px" }}>
                            {order.items && order.items.length > 0 ? (
                              order.items.map((it, idx) => (
                                <div key={idx} className={styles.itemLabel}>• {it.itemName} <span className={styles.itemQty}>(x{it.quantity})</span></div>
                              ))
                            ) : <div className={styles.itemLabel}>• Product <span className={styles.itemQty}>(x{order.pieces || 1})</span></div>}
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                          <div>
                            <div className={styles.label} style={{ fontSize: "9px" }}>Total Value:</div>
                            <div style={{ fontWeight: "850", fontSize: "15px", color: "var(--primary)" }}>Rs. {(order.totalPrice || order.price || 0).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className={styles.label} style={{ fontSize: "9px" }}>Cash Received:</div>
                            <span style={{ cursor: "pointer", display: "inline-block", marginTop: "2px" }} onClick={() => handleQuickStatusChange(order._id, { cashReceived: (order.cashReceived === "Yes" ? "No" : "Yes") })} className={`${styles.badge} ${order.cashReceived === "Yes" ? styles.badgeYes : styles.badgeNo}`}>{order.cashReceived === "Yes" ? "Yes" : "No"}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <div className={styles.field} style={{ flex: 1 }}>
                            <label className={styles.label} style={{ fontSize: "9px" }}>Status:</label>
                            <select className={styles.quickSelect} style={{ width: "100%", marginTop: "2px" }} value={order.deliveryStatus || order.status || "Pending"} onChange={(e) => handleQuickStatusChange(order._id, { deliveryStatus: e.target.value })}>
                              <option value="Pending">Pending</option>
                              <option value="Delivered">Delivered</option>
                              <option value="Return">Returned</option>
                              <option value="Completed">Completed</option>
                            </select>
                          </div>
                          {order.courier && (
                            <div style={{ flex: 1 }}>
                              <div className={styles.label} style={{ fontSize: "9px" }}>Courier:</div>
                              <div style={{ fontWeight: "600", fontSize: "12px", marginTop: "2px" }}>{order.courier}</div>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>{order.trackingNumber || "No tracking"}</div>
                            </div>
                          )}
                        </div>
                        {order.note && <div style={{ fontSize: "12px", background: "rgba(255,255,255,0.02)", padding: "6px", borderRadius: "4px" }}><strong>Note:</strong> {order.note}</div>}
                        <div style={{ display: "flex", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                          <button className={styles.printBtn} style={{ flex: 1 }} onClick={() => handlePrintLabel(order)}>🖨 Print Label</button>
                          <button className={styles.editBtn} style={{ flex: 1 }} onClick={() => initiateOrderEdit(order)}>Edit</button>
                          <button className={styles.deleteBtn} style={{ flex: 1 }} onClick={() => handleOrderDelete(order._id)}>Delete</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        {/* ── TAB 3: EXPENSES MANAGER ── */}
        {activeTab === "expenses" && effectiveView === "admin" && (
          <>
            <div className={styles.filtersRow}>
              <div className={styles.field} style={{ minWidth: "200px" }}>
                <select className={styles.select} value={expenseCategoryFilter} onChange={(e) => setExpenseCategoryFilter(e.target.value)}>
                  <option value="All">All Categories</option>
                  <option value="Stock">Stock Buying</option>
                  <option value="Courier">Courier Charges</option>
                  <option value="Marketing">Marketing / Ads</option>
                  <option value="Other">Other Expenses</option>
                </select>
              </div>
            </div>
            <div className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <div className={styles.tableHeaderInner}>
                  <span className={styles.sectionTitle} style={{ margin: 0 }}>Expenses Log</span>
                  <span className={styles.count}>{filteredExpenses.length} logs</span>
                </div>
              </div>
              <div className={`${styles.tableWrap} ${styles.desktopTableOnly}`}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Expense Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Cost (Rs.)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingExpenses ? (
                      <tr><td colSpan={5} className={styles.emptyCell}>Loading...</td></tr>
                    ) : filteredExpenses.length === 0 ? (
                      <tr><td colSpan={5} className={styles.emptyCell}>No expenses.</td></tr>
                    ) : (
                      filteredExpenses.map((expense) => {
                        const catClass = expense.category === "Stock" ? styles.catStock : expense.category === "Courier" ? styles.catCourier : expense.category === "Marketing" ? styles.catMarketing : styles.catOther;
                        return (
                          <tr key={expense._id}>
                            <td className={styles.dateCell}>{formatDateOnly(expense.dateTime)}</td>
                            <td><span className={`${styles.expenseCategory} ${catClass}`}>{expense.category}</span></td>
                            <td style={{ fontWeight: "500" }}>{expense.description}</td>
                            <td style={{ fontWeight: "700", color: "var(--error)" }}>Rs. {expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td>
                              <div className={styles.actionButtons}>
                                <button className={styles.editBtn} onClick={() => initiateExpenseEdit(expense)}>Edit</button>
                                <button className={styles.deleteBtn} onClick={() => handleExpenseDelete(expense._id)}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── TAB 4: USER ACCOUNTS ── */}
        {activeTab === "users" && effectiveView === "admin" && (
          <div className={styles.tableCard}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Username</th>
                    <th>User Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr><td colSpan={4} className={styles.emptyCell}>Loading...</td></tr>
                  ) : users.map((u) => (
                    <tr key={u._id}>
                      <td style={{ fontWeight: "600" }}>{u.name}</td>
                      <td style={{ fontFamily: "monospace", color: "var(--primary)", fontWeight: "600" }}>@{u.username}</td>
                      <td><span className={styles.badge}>{u.role}</span></td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button className={styles.editBtn} onClick={() => initiateUserEdit(u)}>Edit</button>
                          {u.username !== "admin" && <button className={styles.deleteBtn} onClick={() => handleUserDelete(u._id)}>Delete</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── PACKING STATION (Packer view) ── */}
        {effectiveView === "packer" && (
          <div>
            <div className={styles.packerHeader}>
              <div>
                <h2 className={styles.sectionTitle} style={{ margin: 0 }}>📦 Packing Station</h2>
                <p className={styles.subtitle} style={{ fontSize: "14px" }}>Verify items, print labels and dispatch.</p>
              </div>
            </div>
            <div className={styles.packerSubTabs}>
              <button type="button" className={`${styles.packerSubTab} ${packerSubTab === "pending" ? styles.packerSubTabActive : ""}`} onClick={() => setPackerSubTab("pending")}>⏳ Pending ({packerPendingOrders.length})</button>
              <button type="button" className={`${styles.packerSubTab} ${packerSubTab === "completed" ? styles.packerSubTabActive : ""}`} onClick={() => setPackerSubTab("completed")}>✅ Packed ({packerCompletedOrders.length})</button>
            </div>

            {packerSubTab === "pending" ? (
              packerPendingOrders.length === 0 ? <div className={styles.emptyCell}>🎉 All orders packed!</div> : (
                <div className={styles.packerBoard}>
                  {packerPendingOrders.map((order) => {
                    const orderChecks = packingChecks[order._id] || {};
                    const itemsCount = order.items?.length || 1;
                    const tickedCount = Object.keys(orderChecks).filter(k => orderChecks[k]).length;
                    const allItemsPacked = tickedCount === itemsCount;

                    return (
                      <div key={order._id} className={styles.packerCard}>
                        <div className={styles.packerCardHeader}>
                          <div><strong>{order.orderId || "LEGACY"}</strong></div>
                        </div>
                        <div>
                          <div><strong>{order.name}</strong></div>
                          <div>📞 {order.phoneNumber}</div>
                          <div>📍 {order.address}</div>
                        </div>
                        <div className={styles.packingChecklist}>
                          {order.items?.map((it, idx) => (
                            <label key={idx} className={styles.packingCheckItem}>
                              <input type="checkbox" checked={!!orderChecks[idx]} onChange={() => handleTogglePackCheck(order._id, idx)} />
                              <span>{it.itemName} (x{it.quantity})</span>
                            </label>
                          )) || (
                            <label className={styles.packingCheckItem}>
                              <input type="checkbox" checked={!!orderChecks[0]} onChange={() => handleTogglePackCheck(order._id, 0)} />
                              <span>Product</span>
                            </label>
                          )}
                        </div>
                        <input className={styles.input} placeholder="Courier Service" value={packerCourier[order._id] || ""} onChange={(e) => setPackerCourier({ ...packerCourier, [order._id]: e.target.value })} />
                        <input className={styles.input} placeholder="Tracking Number" value={packerTracking[order._id] || ""} onChange={(e) => setPackerTracking({ ...packerTracking, [order._id]: e.target.value })} />
                        <button className={styles.printBtn} onClick={() => handlePrintLabel(order)}>🖨 Print Label</button>
                        <button className={styles.packConfirmBtn} disabled={!allItemsPacked} onClick={() => handlePackerConfirmPacked(order)}>Confirm Packed</button>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className={styles.packerBoard}>
                {packerCompletedOrders.map((order) => (
                  <div key={order._id} className={styles.packerCompletedCard}>
                    <div><strong>{order.orderId || "LEGACY"}</strong> - {order.name}</div>
                    <button className={styles.printBtn} onClick={() => handlePrintLabel(order)}>🖨 Print Label</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── PORTALED THERMAL LABEL FORMATTED IN STRICT VERTICAL COMPACT ORDER ── */}
      {printOrder && typeof document !== "undefined" && createPortal(
        <div id="print-label-container">
          <div className="thermalLabelCard">
            <div className="thermalLabelCod">
              <span className="thermalLabelCodLeft">C.O.D</span>
              <span className="thermalLabelCodRight" style={{ textAlign: "left", display: "block", width: "100%" }}>
  Rs.______________________
</span>
            </div>
            <div className="thermalLabelContentStack">
              {/* FROM Section */}
              <div className="thermalLabelRowBlock thermalLabelFromBlock">
                <span className="thermalLabelTag">From:</span>
                <span className="thermalLabelLineInline">Geolex Store, No 52, New Shopping Complex, Imaduwa.</span>
                <span className="thermalLabelPhoneInline">0740136448 / 0776171360</span>
              </div>
              {/* TO Section (Strictly below FROM) */}
              <div className="thermalLabelRowBlock">
                <span className="thermalLabelTag">To:</span>
                <span className="thermalLabelLineInline" style={{ fontWeight: "bold" }}>{printOrder.name}, </span>
                <span className="thermalLabelLineInline">{printOrder.address}</span>
                <div style={{ marginTop: "2px" }}>
                  <span className="thermalLabelTag">Tel:</span>
                  <span className="thermalLabelPhoneInline" style={{ fontSize: "12pt", marginLeft: "0" }}>{printOrder.phoneNumber}</span>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}