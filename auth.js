// Credenciales Supabase
const SUPABASE_URL = 'https://mhvvpuvkyjrjvmhowwme.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LCK17AcmINHv8d_X14yuxg_LyeQj172';
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

  // 1. SOLICITAR CÓDIGO Y ENVIAR NOTIFICACIÓN POR CORREO AL DUEÑO
  formRequest.addEventListener('submit', async (e) => {
    e.preventDefault();
    authStatusMsg.style.color = '#a1a1aa';
    authStatusMsg.textContent = 'Procesando solicitud y notificando al administrador...';

    const email = document.getElementById('reqEmail').value.trim();
    const username = document.getElementById('reqUsername').value.trim();
    const password = document.getElementById('reqPassword').value;

    const generatedCode = 'LT-' + Math.floor(1000 + Math.random() * 9000);

    // Guardar en Supabase
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
      authStatusMsg.style.color = '#ef4444';
      authStatusMsg.textContent = error.message.includes('unique') 
        ? 'Este correo ya tiene una solicitud registrada.' 
        : 'Error: ' + error.message;
      return;
    }

    // Enviar correo de notificación a tu email personal vía EmailJS
    try {
      await emailjs.send("service_dtim3ij", "template_6d7x41c", {
        user_email: email,
        user_username: username,
        access_code: generatedCode
      });

      authStatusMsg.style.color = '#22c55e';
      authStatusMsg.textContent = '¡Solicitud enviada con éxito! El administrador ha recibido tu solicitud. Cuando te entregue el código, ingrésalo en la pestaña "Ingresar Código".';
    } catch (emailErr) {
      console.error('Error al enviar email:', emailErr);
      authStatusMsg.style.color = '#eab308';
      authStatusMsg.textContent = 'Solicitud registrada en base de datos. (Hubo un problema enviando el correo de aviso).';
    }
  });

  // 2. VALIDAR CÓDIGO Y ACTIVAR PERFIL
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
      .single();

    if (error || !user) {
      authStatusMsg.style.color = '#ef4444';
      authStatusMsg.textContent = 'Correo o código de acceso inválidos.';
      return;
    }

    await db.from('profiles').update({ is_approved: true }).eq('id', user.id);

    localStorage.setItem('life_trading_user', JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.email
    }));

    authStatusMsg.style.color = '#22c55e';
    authStatusMsg.textContent = '¡Acceso verificado con éxito! Redirigiendo...';
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
  });
});
