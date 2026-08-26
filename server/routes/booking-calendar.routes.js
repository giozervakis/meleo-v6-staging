/*
 * MELEO v6.3.0
 *
 * Booking calendar ICS route.
 *
 * Owns authenticated ICS export for a booking.
 *
 * Extracted byte-safely from relational/app.js.
 */

export function registerBookingCalendarRoutes(
  app,
  deps
) {
  const {
    auth,
    Bookings,
    Professionals,
    canViewBooking,
    canViewPatientContact,
    str
  } = deps


app.get('/api/bookings/:id/calendar.ics',auth,async(req,res)=>{const b=await Bookings.byId(req.params.id);if(!b)return res.status(404).end();const p=await Professionals.byId(b.professionalId);if(!canViewBooking(req.user,b,p))return res.status(403).end();const start=`${b.date.replaceAll('-','')}T${b.time.replace(':','')}00`;const ics=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//MELEO//Booking//EL\r\nBEGIN:VEVENT\r\nUID:${b.id}@meleo.gr\r\nDTSTART:${start}\r\nSUMMARY:MELEO · ${b.service}\r\nLOCATION:${String(b.address||'').replace(/\n/g,' ')}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;res.setHeader('Content-Type','text/calendar; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="meleo-${b.id}.ics"`);res.send(ics)})

}
