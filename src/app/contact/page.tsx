'use client';

import { useState } from 'react';
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
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

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
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.1]">
            Get in touch
          </h1>
          <p className="mt-5 text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Questions, feedback, or just want to say hello? Send a message and we will get back to you as soon as we can.
          </p>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-12 border-b border-border/60">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {contactInfo.map((info, index) => (
              <Card 
                key={index}
                className="group relative overflow-hidden border border-border/60 bg-card shadow-none ring-0 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40"
              >
                <CardContent className="p-6 text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 mb-4 group-hover:scale-110 transition-transform duration-300">
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
                <span>
                  Send Us a Message
                </span>
              </h2>
              <p className="text-muted-foreground mb-8">
                Fill out the form below and we&apos;ll get back to you within 24 hours.
              </p>

              <Card className="border border-border/60 bg-card shadow-none ring-0">
                <CardContent className="p-6">
                  {submitted ? (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/15 mb-4">
                        <CheckCircle className="w-8 h-8 text-success" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Message Sent!</h3>
                      <p className="text-muted-foreground">
                        Thank you for reaching out. We&apos;ll get back to you soon.
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
                        className="w-full group"
                      >
                        <Send className="w-4 h-4 mr-2 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
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
                <span>
                  Frequently Asked Questions
                </span>
              </h2>
              <p className="text-muted-foreground mb-8">
                Can&apos;t find what you&apos;re looking for? Check out these common questions.
              </p>

              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <Card 
                    key={index}
                    className="border border-border/60 bg-card shadow-none ring-0"
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
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/60 bg-card hover:bg-primary/10 transition-all duration-300 group"
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
      <section className="border-t border-border/60 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-bold">Ready to get started?</h2>
            <p className="mt-2 text-muted-foreground">
              Sign in and start tracking your media with Lore.
            </p>
          </div>
          <Link href="/auth/signin">
            <Button size="lg" className="group h-11 px-5 text-sm">
              <Zap className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
              Start tracking
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

