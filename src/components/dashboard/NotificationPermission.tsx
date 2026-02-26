"use client";

import { requestNotificationPermission } from "@/lib/requestNotificationPermission";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

const NotificationPermission = () => {
    const { appUser, status } = useAuth();
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (!appUser?.id || initialized || status !== 'authenticated') return;

        setInitialized(true);
        requestNotificationPermission(appUser.id);
    }, [appUser, initialized, status]);

    return null;
};

export default NotificationPermission;