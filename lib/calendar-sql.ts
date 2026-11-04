/** Visibility is enforced in SQL, never only in the UI:
 *  private → creator or owner; team → everyone with calendar.view; executive → calendar.view_executive (or creator/owner);
 *  customer follow-ups additionally need crm.followup (or creator/owner). */
export const MANUAL_SQL = `
  select e.id, e.title, e.short_title, e.kind, e.starts_on::text as start, e.ends_on::text as "end", e.all_day,
         to_char(e.start_time, 'HH24:MI') as start_time, to_char(e.end_time, 'HH24:MI') as end_time,
         e.repeat, e.repeat_until::text as repeat_until, e.owner_user_id, u.display_name as owner_name, e.created_by,
         e.status, e.remind_minutes, e.details, e.link_url, e.visibility
    from calendar_events e left join users u on u.id = e.owner_user_id
   where e.org_id = $1
     and e.starts_on <= $3::date
     and (e.ends_on >= $2::date or (e.repeat <> 'none' and (e.repeat_until is null or e.repeat_until >= $2::date)))
     and (e.created_by = $4 or e.owner_user_id = $4 or e.visibility = 'team' or (e.visibility = 'executive' and $5::boolean))
     and (e.kind <> 'followup' or $6::boolean or e.created_by = $4 or e.owner_user_id = $4)
     and ($7::uuid is null or e.id = $7::uuid)`;
