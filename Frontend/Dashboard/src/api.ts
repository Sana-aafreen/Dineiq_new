const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

export const ONLINE_API_BASE_URL = normalizeBaseUrl(
    import.meta.env.VITE_API_URL || "http://localhost:8000"
);
export const LOCAL_API_BASE_URL = normalizeBaseUrl(
    import.meta.env.VITE_LOCAL_API_URL || "http://localhost:8002"
);
export const NETWORK_MODE_STORAGE_KEY = "dineiq_network_mode";

export const getDashboardApiBase = () => {
    if (typeof window === "undefined") return ONLINE_API_BASE_URL;
    const mode = window.localStorage.getItem(NETWORK_MODE_STORAGE_KEY);
    return mode === "local" ? LOCAL_API_BASE_URL : ONLINE_API_BASE_URL;
};

export const API_BASE_URL = getDashboardApiBase();

export const fetchDashboardDataset = async <T = any>(path: string, key: string): Promise<T[]> => {
    const response = await fetch(`${getDashboardApiBase()}${path}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${key}`);
    }
    const data = await response.json();
    return data[key] || [];
};

export const postCampaign = async (payload: any) => {
    const response = await fetch(`${getDashboardApiBase()}/campaigns/add`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create campaign");
    }

    return response.json();
};

export const fetchReviews = async () => {
    const response = await fetch(`${getDashboardApiBase()}/reviews/list`);
    if (!response.ok) throw new Error("Failed to fetch reviews");
    return response.json();
};

export const updateReview = async (reviewId: string, payload: any) => {
    const response = await fetch(`${getDashboardApiBase()}/reviews/update/${reviewId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to update review");
    }

    return response.json();
};
