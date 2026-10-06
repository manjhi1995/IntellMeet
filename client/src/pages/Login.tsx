import { useState } from 'react' 
import { Link, useNavigate } from 'react-router-dom' 
import '../App.css' 
 
function Login() { 
  const navigate = useNavigate() 
 
  const [email, setEmail] = useState('') 
  const [password, setPassword] = useState('') 
  const [showPassword, setShowPassword] = useState(false) 
  const [message, setMessage] = useState('') 
  const [isSuccess, setIsSuccess] = useState(false) 
 
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => { 
    event.preventDefault() 
 
    setMessage('') 
    setIsSuccess(false) 
 
    if (!email || !password) { 
      setMessage('Please enter your email and password.') 
      return 
    } 
 
    if (password.length < 6) { 
      setMessage('Password must be at least 6 characters.') 
      return 
    } 
 
    setMessage('Login successful!') 
    setIsSuccess(true) 
 
    setTimeout(() => { 
      navigate('/') 
    }, 1000) 
  } 
 
  return ( 
    <main className="auth-page"> 
      <div className="auth-card"> 
 
        <div className="auth-logo"> 
          <span className="logo-icon">✦</span> 
          <span>IntellMeet</span> 
        </div> 
 
        <h1>Welcome back</h1> 
 
        <p className="auth-subtitle"> 
          Sign in to continue to your meetings. 
        </p> 
 
        <form className="auth-form" onSubmit={handleSubmit}> 
 
          <label htmlFor="email">Email</label> 
 
          <input 
            id="email" 
            type="email" 
            placeholder="Enter your email" 
            value={email} 
            onChange={(event) => setEmail(event.target.value)} 
          /> 
 
          <label htmlFor="password">Password</label> 
 
          <div className="password-wrapper"> 
 
            <input 
              id="password" 
              type={showPassword ? 'text' : 'password'} 
              placeholder="Enter your password" 
              value={password} 
              onChange={(event) => setPassword(event.target.value)} 
            /> 
 
            <button 
              type="button" 
              className="password-toggle" 
              onClick={() => 
                setShowPassword((previous) => !previous) 
              } 
            > 
              {showPassword ? 'Hide' : 'Show'} 
            </button> 
 
          </div> 
 
          {message && ( 
            <p className={isSuccess ? 'form-success' : 'form-error'}> 
              {message} 
            </p> 
          )} 
 
          <button type="submit" className="primary-btn"> 
            Log In 
          </button> 
 
        </form> 
 
        <p className="auth-footer"> 
          Don't have an account?{' '} 
          <Link to="/signup"> 
            Create an account 
          </Link> 
        </p> 
 
      </div> 
    </main> 
  ) 
} 
 
export default Login