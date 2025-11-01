'use client'

import { useState } from 'react'
import { Sparkles, Loader2, MessageSquare, X, Send } from 'lucide-react'

interface AgentPanelProps {
  results: {
    fileName: string
    totalProviders: number
    totalClaims: number
    leadCount: number
    leads: any[]
  }
}

export default function AgentPanel({ results }: AgentPanelProps) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [chatMessage, setChatMessage] = useState('')
  const [isChatting, setIsChatting] = useState(false)

  const analyzeWithAI = async () => {
    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/agent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: results.leads,
          totalClaims: results.totalClaims,
          totalProviders: results.totalProviders,
          fileName: results.fileName,
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        setAnalysis(data.analysis)
      } else {
        setAnalysis('Analysis failed: ' + data.error)
      }
    } catch (error: any) {
      setAnalysis('Error: ' + error.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return

    const userMessage = chatMessage.trim()
    setChatMessage('')
    
    // Add user message to history
    const newHistory = [...chatHistory, { role: 'user' as const, content: userMessage }]
    setChatHistory(newHistory)
    setIsChatting(true)

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          context: {
            leads: results.leads,
            fileName: results.fileName,
          },
          conversationHistory: newHistory,
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        setChatHistory([...newHistory, { role: 'assistant', content: data.response }])
      } else {
        setChatHistory([...newHistory, { role: 'assistant', content: 'Error: ' + data.error }])
      }
    } catch (error: any) {
      setChatHistory([...newHistory, { role: 'assistant', content: 'Error: ' + error.message }])
    } finally {
      setIsChatting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Analyze Button */}
      {!analysis && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-6 h-6 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">AI Agent Analysis</h3>
              </div>
              <p className="text-gray-600 mb-4">
                Get intelligent insights and recommendations from our FWA detection agent. 
                The agent will analyze all {results.leadCount} flagged providers and provide actionable guidance.
              </p>
              <button
                onClick={analyzeWithAI}
                disabled={isAnalyzing}
                className="inline-flex items-center px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Analyze with AI Agent
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">AI Agent Analysis</h3>
              </div>
              <button
                onClick={() => setShowChat(!showChat)}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                {showChat ? 'Hide Chat' : 'Ask Questions'}
              </button>
            </div>
          </div>
          
          <div className="p-6">
            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                {analysis}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {showChat && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-purple-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Chat with Agent</h3>
            </div>
            <button
              onClick={() => setShowChat(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="h-96 overflow-y-auto p-6 space-y-4">
            {chatHistory.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">Ask me anything about the detection results</p>
                <p className="text-xs mt-2">Try: "Why is P10027 flagged?" or "What patterns do you see?"</p>
              </div>
            ) : (
              chatHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))
            )}
            
            {isChatting && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-2">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Ask about providers, patterns, or recommendations..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isChatting}
              />
              <button
                onClick={sendChatMessage}
                disabled={isChatting || !chatMessage.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
