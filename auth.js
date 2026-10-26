// Credenciales Supabase
const SUPABASE_URL = 'https://okihugbwtxbycvjiskyf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9raWh1Z2J3dHhieWN2amlza3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNDMxODQsImV4cCI6MjEwODYxOTE4NH0.tUIXj2-LHngS4pEn36XSk9kVs2GvFDXKhlZDA0tgnR8';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Inicializar EmailJS
if (typeof emailjs !== 'undefined') {
  emailjs.init("4YWvGd62dXMQwTMuj");
}

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
      if (authStatusMsg) authStatusMsg.textContent = '';
    });

    tabValidate.addEventListener('click', () => {
      tabValidate.classList.add('active');
      tabRequest.classList.remove('active');
      formValidate.style.display = 'flex';
      formRequest.style.display = 'none';
      if (authStatusMsg) authStatusMsg.textContent = '';
    });
  }

  // 1. SOLICITAR CÓDIGO (INSERCIÓN DIRECTA + EMAILJS)
  if (formRequest) {
    formRequest.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (authStatusMsg) {
        authStatusMsg.style.color = '#a1a1aa';
        authStatusMsg.textContent = 'Enviando solicitud...';
      }

      const email = document.getElementById('reqEmail').value.trim();
      const username = document.getElementById('reqUsername').value.trim();
      const password = document.getElementById('reqPassword').value;

      const generatedCode = 'LT-' + Math.floor(1000 + Math.random() * 9000);

      // Guardar directamente en la tabla
      const { error } = await db.from('profiles').insert([
        {
          email: email,
          username: username,
          password_hash: password,
          access_code: generatedCode,
          is_approved: false
        }
      ]);

      if (error) {
        if (authStatusMsg) {
          authStatusMsg.style.color = '#ef4444';
          authStatusMsg.textContent = error.message.includes('unique') 
            ? 'Este correo ya tiene un código generado.' 
            : 'Error: ' + error.message;
        }
        return;
      }

      // Enviar correo por EmailJS
      try {
        await emailjs.send("service_dtim3ij", "template_6d7x41c", {
          to_email: email,
          user_email: email,
          user_name: username,
          user_username: username,
          access_code: generatedCode
        });

        if (authStatusMsg) {
          authStatusMsg.style.color = '#22c55e';
          authStatusMsg.textContent = '¡Código generado y enviado a tu correo! Ingrésalo en la pestaña "Ingresar Código".';
        }
      } catch (emailErr) {
        console.error('Error enviando correo:', emailErr);
        if (authStatusMsg) {
          authStatusMsg.style.color = '#eab308';
          authStatusMsg.textContent = 'Código guardado en base de datos (hubo un problema al enviar el correo).';
        }
      }
    });
  }

  // 2. VALIDAR CÓDIGO E INGRESAR
  if (formValidate) {
    formValidate.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (authStatusMsg) {
        authStatusMsg.style.color = '#a1a1aa';
        authStatusMsg.textContent = 'Validando código...';
      }

      const email = document.getElementById('valEmail').value.trim();
      const code = document.getElementById('valCode').value.trim().toUpperCase();

      const { data: user, error } = await db
        .from('profiles')
        .select('*')
        .eq('email', email)
        .eq('access_code', code)
        .maybeSingle();

      if (error || !user) {
        if (authStatusMsg) {
          authStatusMsg.style.color = '#ef4444';
          authStatusMsg.textContent = 'Correo o código de acceso incorrectos.';
        }
        return;
      }

      // Marcar como aprobado
      await db.from('profiles').update({ is_approved: true }).eq('id', user.id);

      // Guardar sesión local
      localStorage.setItem('life_trading_user', JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email
      }));

      if (authStatusMsg) {
        authStatusMsg.style.color = '#22c55e';
        authStatusMsg.textContent = '¡Acceso verificado! Redirigiendo...';
      }

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    });
  }
});
