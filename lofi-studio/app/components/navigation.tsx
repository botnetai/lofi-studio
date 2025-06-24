import { Link } from '@tanstack/react-router'
import { Music2, Image, Package, Upload, Moon, Sun, Monitor } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/Button'
import { useTheme } from './theme-provider'

const navigation = [
  { name: 'Music', href: '/', icon: Music2 },
  { name: 'Artwork', href: '/artwork', icon: Image },
  { name: 'Compile', href: '/compile', icon: Package },
  { name: 'Publish', href: '/publish', icon: Upload },
]

export function Navigation() {
  const { theme, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <Music2 className="h-6 w-6" />
            <span className="hidden font-bold sm:inline-block">
              Lofi Studio
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navigation.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "transition-colors hover:text-foreground/80",
                  "text-foreground/60"
                )}
                activeProps={{
                  className: "text-foreground"
                }}
              >
                <span className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{item.name}</span>
                </span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (theme === "light") setTheme("dark")
                else if (theme === "dark") setTheme("system")
                else setTheme("light")
              }}
              title={`Current theme: ${theme}. Click to change.`}
            >
              {theme === "light" && <Sun className="h-[1.2rem] w-[1.2rem]" />}
              {theme === "dark" && <Moon className="h-[1.2rem] w-[1.2rem]" />}
              {theme === "system" && <Monitor className="h-[1.2rem] w-[1.2rem]" />}
              <span className="sr-only">Toggle theme (current: {theme})</span>
            </Button>
            <Button variant="ghost" size="sm">
              Log in
            </Button>
            <Button size="sm">
              Sign up
            </Button>
          </nav>
        </div>
      </div>
    </header>
  )
}