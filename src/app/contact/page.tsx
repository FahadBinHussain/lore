'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, Mail, Phone, MapPin, Clock,
  MessageCircle, Send, Globe, Heart, Zap, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const contactInfo = [
  {
    icon: Mail,
    title: 'Email Us',
    description: 'Send us an email anytime',
    value: 'hello@lore.app',
    href: 'mailto:hello@lore.app'
  },
  {
    icon: Phone,
    title: 'Call Us',
    description: 'Mon-Fri from 8am to 5pm',
    value: '+1 (555) 123-4567',
    href: 'tel:+15551234567'
  },
  {
    icon: MapPin,
    title: 'Visit Us',
    description: 'Come say hello at our office',
    value: '123 Media Street, San Francisco, CA',
    href: '#'
  },
  {
    icon: Clock,
    title: 'Working Hours',
    description: 'We are available',
    value: 'Mon-Fri: 8am - 5pm PST',
    href: '#'
  }
];

const socialLinks = [
  { icon: Globe, label: 'Website', href: '#' },
  { icon: MessageCircle, label: 'Twitter', href: '#' },
  { icon: Heart, label: 'Instagram', href: '#' }
];

const faqs = [
  {
    question: 'How do I get started with Lore?',
    answer: 'Simply sign up for a free account and start tracking your favorite movies, TV shows, games, and books. Our intuitive interface makes it easy to organize your media library.'
  },
  {
    question: 'Is Lore free to use?',
    answer: 'Yes! Lore offers a free tier with all essential features. We also offer premium plans with advanced features for power users.'
  },
  {
    question: 'Can I import my existing media lists?',
    answer: 'Absolutely! We support importing from popular platforms like IMDb, Goodreads, and Steam. Check our import tools in your dashboard.'
  },
  {
    question: 'How do you handle my data?',
    answer: 'We take privacy seriously. Your data is encrypted and never shared with third parties. You can export or delete your data at any time.'
  }
];

export default function ContactPage() {
  const [mounted, setMounted] = useState(false);
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate form submission
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormState({ name: '', email: '', subject: '', message: '' });
    }, 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormState(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="relative z-50 border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/90 to-background/80 backdrop-blur-xl" />
        
        <div className="relative w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <img
                src="/logo.png?v=3"
                alt="Lore logo"
                className="w-10 h-10 rounded-2xl object-contain bg-transparent shadow-lg shadow-primary/20 group-hover:shadow-xl group-hover:shadow-primary/30 transition-all duration-300 group-hover:scale-105"
              />
              <div className="flex flex-col">
                <span className="font-bold text-xl bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                  Lore
                </span>
                <span className="text-[10px] text-muted-foreground font-medium -mt-1">Media Tracker</span>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Home
              </Link>
              <Link href="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                About
              </Link>
              <Link href="/contact" className="text-sm font-medium text-foreground transition-colors">
                Contact
              </Link>
            </nav>

            {/* CTA */}
            <Link href="/auth/signin">
              <Button className="bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-secondary/10 to-transparent rounded-full blur-2xl" />
        
        <div className="relative w-full px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-8">
            <Badge variant="outline" className="mb-4 bg-primary/10 text-primary border-primary/30">
              <MessageCircle className="w-3 h-3 mr-1" />
              Contact Us
            </Badge>
            
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
                Get in Touch
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Have questions, feedback, or just want to say hello? We'd love to hear from you. 
              Our team is here to help and we'll get back to you as soon as possible.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-16 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {contactInfo.map((info, index) => (
              <Card 
                key={index}
                className="group relative overflow-hidden border-0 bg-card/50 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-xl"
              >
                <CardContent className="p-6 text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 mb-4 group-hover:scale-110 transition-transform duration-300">
                    <info.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">{info.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{info.description}</p>
                  <a 
                    href={info.href}
                    className="text-primary font-medium hover:underline transition-all"
                  >
                    {info.value}
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Form */}
            <div>
              <Badge variant="outline" className="mb-4 bg-primary/10 text-primary border-primary/30">
                <Send className="w-3 h-3 mr-1" />
                Send Message
              </Badge>
              <h2 className="text-3xl font-bold mb-4">
                <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                  Send Us a Message
                </span>
              </h2>
              <p className="text-muted-foreground mb-8">
                Fill out the form below and we'll get back to you within 24 hours.
              </p>

              <Card className="border-0 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  {submitted ? (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Message Sent!</h3>
                      <p className="text-muted-foreground">
                        Thank you for reaching out. We'll get back to you soon.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <Input
                            id="name"
                            name="name"
                            placeholder="Your name"
                            value={formState.name}
                            onChange={handleChange}
                            required
                            className="bg-background/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="your@email.com"
                            value={formState.email}
                            onChange={handleChange}
                            required
                            className="bg-background/50"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input
                          id="subject"
                          name="subject"
                          placeholder="What is this about?"
                          value={formState.subject}
                          onChange={handleChange}
                          required
                          className="bg-background/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea
                          id="message"
                          name="message"
                          placeholder="Tell us more about your inquiry..."
                          value={formState.message}
                          onChange={handleChange}
                          required
                          rows={5}
                          className="bg-background/50 resize-none"
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send Message
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* FAQ Section */}
            <div>
              <Badge variant="outline" className="mb-4 bg-primary/10 text-primary border-primary/30">
                <Zap className="w-3 h-3 mr-1" />
                FAQ
              </Badge>
              <h2 className="text-3xl font-bold mb-4">
                <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                  Frequently Asked Questions
                </span>
              </h2>
              <p className="text-muted-foreground mb-8">
                Can't find what you're looking for? Check out these common questions.
              </p>

              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <Card 
                    key={index}
                    className="border-0 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300"
                  >
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-lg mb-2">{faq.question}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{faq.answer}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Social Links */}
              <div className="mt-12">
                <h3 className="font-semibold text-lg mb-4">Connect With Us</h3>
                <div className="flex gap-4">
                  {socialLinks.map((social, index) => (
                    <a
                      key={index}
                      href={social.href}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 backdrop-blur-sm hover:bg-primary/10 transition-all duration-300 group"
                    >
                      <social.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        {social.label}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10" />
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-8">
            <h2 className="text-4xl sm:text-5xl font-bold">
              <span className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Ready to Get Started?
              </span>
            </h2>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join thousands of users who are already tracking their media with Lore.
            </p>
            
            <Link href="/auth/signin">
              <Button size="lg" className="group bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300">
                <Zap className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                Start Tracking Free
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <Link href="/" className="flex items-center gap-3 mb-4 md:mb-0">
              <img
                src="/logo.png?v=3"
                alt="Lore logo"
                className="w-10 h-10 rounded-2xl object-contain bg-transparent shadow-lg shadow-primary/20"
              />
              <span className="font-bold text-xl">Lore</span>
            </Link>
            
            <div className="flex items-center gap-6">
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Home
              </Link>
              <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                About
              </Link>
              <Link href="/contact" className="text-sm text-foreground transition-colors">
                Contact
              </Link>
            </div>
            
            <p className="text-sm text-muted-foreground mt-4 md:mt-0">
              © 2026 Lore. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

