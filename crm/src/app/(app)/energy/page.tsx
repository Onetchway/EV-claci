import { redirect } from "next/navigation";

/** Energy was merged into Earnings & Statistics — this stays only so old bookmarks/links don't 404. */
export default function EnergyRedirect() {
  redirect("/earnings");
}
