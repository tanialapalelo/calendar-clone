import {Suspense} from "react";
import CalendarPageClient from "@/components/calendar/CalendarPageClient";


export default function HomePage() {

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CalendarPageClient />
    </Suspense>
  );
}
