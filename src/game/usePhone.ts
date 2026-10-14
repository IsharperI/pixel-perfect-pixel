import { useEffect, useState } from "react";

/** Phone-sized screens (up to 600px wide) get the phone layout: a bottom drawer and a trimmed top bar. */
export const PHONE_QUERY = "(max-width: 600px)";
export const isPhone = () => typeof window !== "undefined" && !!window.matchMedia?.(PHONE_QUERY).matches;

export function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}
