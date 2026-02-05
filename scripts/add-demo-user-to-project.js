const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://qzvulqjuvloatwbkidxm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnVscWp1dmxvYXR3YmtpZHhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTMzMjE5MCwiZXhwIjoyMDg0OTA4MTkwfQ.oDe1WT5hlUN1vwgMNC2tEPf9qc6usdGYbcehHZrsPmw'
);

async function addUserToProject() {
  // Find the Know It More project
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('*')
    .ilike('name', 'Know It More');

  if (projError) {
    console.error('Failed to find project:', projError);
    return;
  }
  console.log('Found projects:', projects);

  if (!projects || projects.length === 0) {
    console.error('Project not found');
    return;
  }

  const project = projects[0];
  const userId = 'cc1d282e-afbd-4084-99ce-2e9c54d27fb4';

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', project.id)
    .eq('user_id', userId)
    .single();

  if (existingMember) {
    console.log('User is already a member:', existingMember);
    return;
  }

  // Add user as editor
  const { data: member, error: memberError } = await supabase
    .from('project_members')
    .insert({
      project_id: project.id,
      user_id: userId,
      role: 'editor',
      can_create_stories: true,
      can_approve_stories: true,
      can_generate_scripts: true,
      can_invite_members: false
    })
    .select()
    .single();

  if (memberError) {
    console.error('Failed to add member:', memberError);
    return;
  }

  console.log('Added member:', member);
}

addUserToProject().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
