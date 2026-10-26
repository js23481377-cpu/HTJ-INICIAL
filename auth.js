// Credenciales Supabase (Actualizadas)
const SUPABASE_URL = 'https://okihugbwtxbycvjiskyf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9raWh1Z2J3dHhieWN2amlza3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDMxODQsImV4cCI6MjEwODYxOTE4NH0.tUIXj2-LHngS4pEn36XSk9kVs2GvFDXKhlZDA0tgnR8';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Inicializar EmailJS con tu Public Key
emailjs.init("4YWvGd62dXMQwTMuj");

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  const tabRequest = document.getElementById('tabRequest');
  const tabValidate = document.getElementById('tabValidate');
  const formRequest = document.getElementById('formRequest');
  const formValidate = document.getElementById('formValidate');
  const authStatusMsg = document.getElementById('authStatusMsg');

  if (tabRequest && tabValidate) {
    tabRequest.addEventListener('click', () => {
      tabRequest.classList.add('active');
      tabValidate.classList.remove('active');
      formRequest.style.display = 'flex';
      formValidate.style.display = 'none';
      authStatusMsg.textContent = '';
    });

    tabValidate.addEventListener('click', () => {
      tabValidate.classList.add('active');
      tabRequest.classList.remove('active');
      formValidate.style.display = 'flex';
      formRequest.style.display = 'none';
      authStatusMsg.textContent = '';
    });
  }

  // 1. SOLICITAR CÓDIGO Y REGISTRAR EN SUPABASE + EMAILJS
  if (formRequest) {
    formRequest.addEventListener('submit', async (e) => {
      e.preventDefault();
      authStatusMsg.style.color = '#a1a1aa';
      authStatusMsg.textContent = 'Procesando solicitud y notificando...';

      const email = document.getElementById('reqEmail').value.trim();
      const username = document.getElementById('reqUsername').value.trim();
      const password = document.getElementById('reqPassword').value;

      const generatedCode = 'LT-' + Math.floor(1000 + Math.random() * 9000);

      try {
        // Registrar cuenta en Supabase Auth (El Trigger creará la fila en profiles automáticamente)
        const { data, error } = await db.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              full_name: username,
              access_code: generatedCode
            }
          }
        });

        if (error) {
          authStatusMsg.style.color = '#ef4444';
          authStatusMsg.textContent = error.message.includes('already registered') 
            ? 'Este correo ya tiene una solicitud registrada.' 
            : 'Error: ' + error.message;
          return;
        }

        // Enviar correo de notificación vía EmailJS
        await emailjs.send("service_dtim3ij", "template_6d7x41c", {
          to_email: email,
          user_email: email,
          user_name: username,
          user_username: username,
          access_code: generatedCode
        });

        authStatusMsg.style.color = '#22c55e';
        authStatusMsg.textContent = '¡Solicitud enviada con éxito! Revisa tu correo o ingresa el código en la pestaña "Ingresar Código".';

      } catch (emailErr) {
        console.error('Error durante el proceso:', emailErr);
        authStatusMsg.style.color = '#eab308';
        authStatusMsg.textContent = 'Solicitud registrada. (Ocurrió un detalle al enviar el correo).';
      }
    });
  }

  // 2. VALIDAR CÓDIGO Y ACTIVAR PERFIL
  if (formValidate) {
    formValidate.addEventListener('submit', async (e) => {
      e.preventDefault();
      authStatusMsg.style.color = '#a1a1aa';
      authStatusMsg.textContent = 'Validando código...';

      const email = document.getElementById('valEmail').value.trim();
      const code = document.getElementById('valCode').value.trim().toUpperCase();

      const { data: user, error } = await db
        .from('profiles')
        .select('*')
        .eq('email', email)
        .eq('access_code', code)
        .maybeSingle();

      if (error || !user) {
        authStatusMsg.style.color = '#ef4444';
        authStatusMsg.textContent = 'Correo o código de acceso inválidos.';
        return;
      }

      await db.from('profiles').update({ is_approved: true }).eq('id', user.id);

      localStorage.setItem('life_trading_user', JSON.stringify({
        id: user.id,
        username: user.full_name || user.email.split('@')[0],
        email: user.email
      }));

      authStatusMsg.style.color = '#22c55e';
      authStatusMsg.textContent = '¡Acceso verificado con éxito! Redirigiendo...';
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    });
  }
});
